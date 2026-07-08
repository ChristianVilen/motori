import fs from "node:fs/promises";
import path from "node:path";
import {
	DeleteObjectCommand,
	DeleteObjectsCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

export interface ImageStorage {
	upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
	delete(url: string): Promise<void>;
	deleteByPrefix(prefix: string): Promise<void>;
}

// ── Hetzner Object Storage (S3-compatible) ─────────────────────────────────

export class HetznerStorage implements ImageStorage {
	private client: S3Client;
	private bucket: string;
	private publicUrl: string;

	constructor() {
		this.client = new S3Client({
			region: "hel1",
			endpoint: process.env.STORAGE_ENDPOINT,
			credentials: {
				accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
				secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
			},
			forcePathStyle: true,
		});
		this.bucket = process.env.STORAGE_BUCKET ?? "";
		this.publicUrl = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "");
	}

	async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			}),
		);
		return `${this.publicUrl}/${key}`;
	}

	async delete(url: string): Promise<void> {
		if (!this.publicUrl || !url.startsWith(this.publicUrl)) {
			return;
		}
		const key = url.slice(this.publicUrl.length).replace(/^\//, "");
		if (!key) {
			return;
		}
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}

	async deleteByPrefix(prefix: string): Promise<void> {
		let continuationToken: string | undefined;
		do {
			const list = await this.client.send(
				new ListObjectsV2Command({
					Bucket: this.bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				}),
			);
			const keys = (list.Contents ?? []).map((o) => o.Key).filter(Boolean) as string[];
			if (keys.length) {
				await this.client.send(
					new DeleteObjectsCommand({
						Bucket: this.bucket,
						Delete: { Objects: keys.map((Key) => ({ Key })) },
					}),
				);
			}
			continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
		} while (continuationToken);
	}
}

// ── Local filesystem (dev) ─────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export class LocalStorage implements ImageStorage {
	async upload(buffer: Buffer, key: string, _contentType: string): Promise<string> {
		const filePath = path.join(UPLOADS_DIR, key);
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, buffer);
		return `/api/uploads/${key}`;
	}

	async delete(url: string): Promise<void> {
		if (!url.startsWith("/api/uploads/")) {
			return;
		}
		const filePath = path.join(UPLOADS_DIR, url.replace("/api/uploads/", ""));
		if (!filePath.startsWith(UPLOADS_DIR)) {
			return;
		}
		await fs.unlink(filePath).catch(() => {});
	}

	async deleteByPrefix(prefix: string): Promise<void> {
		const dir = path.join(UPLOADS_DIR, prefix);
		await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}

// ── Factory ────────────────────────────────────────────────────────────────

let _storage: ImageStorage | null = null;

export function getImageStorage(): ImageStorage {
	if (_storage) {
		return _storage;
	}
	_storage = process.env.STORAGE_ENDPOINT ? new HetznerStorage() : new LocalStorage();
	return _storage;
}

// ── Image optimization + upload ────────────────────────────────────────────

const TARGET_WIDTH = 1600;
const THUMB_WIDTH = 400;

export async function optimizeAndUpload(
	raw: Buffer,
	key: string,
	thumbKey: string,
): Promise<{ url: string; thumbnailUrl: string; optimizedSize: number }> {
	const { default: sharp } = await import("sharp");

	const [optimized, thumbnail] = await Promise.all([
		sharp(raw)
			.resize(TARGET_WIDTH, undefined, { withoutEnlargement: true })
			.webp({ quality: 80 })
			.toBuffer(),
		sharp(raw)
			.resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
			.webp({ quality: 70 })
			.toBuffer(),
	]);

	const storage = getImageStorage();
	const [url, thumbnailUrl] = await Promise.all([
		storage.upload(optimized, key, "image/webp"),
		storage.upload(thumbnail, thumbKey, "image/webp"),
	]);

	return { url, thumbnailUrl, optimizedSize: optimized.length };
}
