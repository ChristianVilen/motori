import fs from "node:fs/promises";
import path from "node:path";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

export const DOC_EXT_BY_MIME: Record<string, string> = {
	"application/pdf": "pdf",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export interface StoredDocument {
	body: ReadableStream<Uint8Array> | Uint8Array;
	contentType: string;
	contentLength?: number;
}

export interface DocumentStorage {
	upload(buffer: Buffer, key: string, contentType: string): Promise<void>;
	get(key: string): Promise<StoredDocument | null>;
	delete(key: string): Promise<void>;
}

// ── Hetzner Object Storage (S3-compatible), PRIVATE bucket ─────────────────
// Deliberately no public-URL config: documents are only reachable through the
// app's authenticated proxy route, so a misconfiguration can't publish PII.

export class HetznerDocumentStorage implements DocumentStorage {
	private client: S3Client;
	private bucket: string;

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
		this.bucket = process.env.STORAGE_DOCS_BUCKET ?? "";
	}

	async upload(buffer: Buffer, key: string, contentType: string): Promise<void> {
		await this.client.send(
			new PutObjectCommand({
				Bucket: this.bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			}),
		);
	}

	async get(key: string): Promise<StoredDocument | null> {
		try {
			const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
			if (!res.Body) {
				return null;
			}
			return {
				body: res.Body.transformToWebStream(),
				contentType: res.ContentType ?? "application/octet-stream",
				contentLength: res.ContentLength,
			};
		} catch (err) {
			// Only a missing object is "not found" — outages/misconfig must surface, not 404.
			if (err instanceof Error && (err.name === "NoSuchKey" || err.name === "NotFound")) {
				return null;
			}
			throw err;
		}
	}

	async delete(key: string): Promise<void> {
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}
}

// ── Local filesystem (dev) ─────────────────────────────────────────────────
// Deliberately OUTSIDE ./uploads: the public, unauthenticated /api/uploads
// route serves everything under that dir, so private documents must not live
// inside it. Dev reads go through the same authenticated proxy route as prod,
// via get().

const DOCS_DIR = path.resolve(process.cwd(), "uploads-docs");

export class LocalDocumentStorage implements DocumentStorage {
	private resolveSafe(key: string): string | null {
		const filePath = path.resolve(DOCS_DIR, key);
		return filePath.startsWith(DOCS_DIR + path.sep) ? filePath : null;
	}

	async upload(buffer: Buffer, key: string, _contentType: string): Promise<void> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			throw new Error(`Invalid document key: ${key}`);
		}
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, buffer);
	}

	async get(key: string): Promise<StoredDocument | null> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			return null;
		}
		try {
			const body = await fs.readFile(filePath);
			const ext = path.extname(filePath).slice(1);
			const contentType =
				Object.entries(DOC_EXT_BY_MIME).find(([, e]) => e === ext)?.[0] ??
				"application/octet-stream";
			return { body: new Uint8Array(body), contentType, contentLength: body.length };
		} catch {
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			return;
		}
		await fs.unlink(filePath).catch(() => {});
	}
}

// ── Factory ────────────────────────────────────────────────────────────────

let _storage: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
	if (_storage) {
		return _storage;
	}
	if (process.env.STORAGE_ENDPOINT && !process.env.STORAGE_DOCS_BUCKET) {
		// Object storage is configured but the private docs bucket isn't — refusing to
		// silently write PII documents to ephemeral local disk in a deployed environment.
		throw new Error("STORAGE_DOCS_BUCKET must be set when STORAGE_ENDPOINT is configured");
	}
	_storage = process.env.STORAGE_ENDPOINT
		? new HetznerDocumentStorage()
		: new LocalDocumentStorage();
	return _storage;
}
