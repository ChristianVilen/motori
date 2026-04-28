// src/lib/image-storage.ts
// Storage abstraction: Cloudflare Images (prod) or local filesystem (dev).

import fs from "node:fs/promises";
import path from "node:path";

export interface ImageStorage {
	upload(buffer: Buffer, key: string, contentType: string): Promise<string>;
	delete(url: string): Promise<void>;
	deleteByPrefix(prefix: string): Promise<void>;
}

// ── Cloudflare Images ──────────────────────────────────────────────────────

export class CloudflareStorage implements ImageStorage {
	private accountId: string;
	private apiToken: string;

	constructor() {
		this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
		this.apiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
		if (!this.accountId || !this.apiToken) {
			throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required");
		}
	}

	async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
		const form = new FormData();
		form.append("file", new Blob([buffer], { type: contentType }), key);
		form.append("id", key);

		const res = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1`,
			{ method: "POST", headers: { Authorization: `Bearer ${this.apiToken}` }, body: form },
		);
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Cloudflare upload failed: ${res.status} ${body}`);
		}
		const json = (await res.json()) as { result: { variants: string[] } };
		// Return the "public" variant URL
		return json.result.variants[0];
	}

	async delete(url: string): Promise<void> {
		// Cloudflare Images URL: https://imagedelivery.net/<account-hash>/<image-id>/<variant>
		// The image ID is the key we set during upload (e.g. listings/userId/timestamp.webp)
		const parts = new URL(url).pathname.split("/").filter(Boolean);
		// parts: [account-hash, image-id, variant] — image-id is at index 1
		const id = parts[1];
		if (!id) {
			return;
		}
		await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/images/v1/${id}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${this.apiToken}` },
		});
	}

	async deleteByPrefix(_prefix: string): Promise<void> {
		// Cloudflare Images doesn't support prefix-based deletion.
		// Account deletion will delete listing_image rows; orphaned CF images
		// can be cleaned up via a scheduled job if needed.
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
	const mode = process.env.IMAGE_STORAGE ?? "local";
	_storage = mode === "cloudflare" ? new CloudflareStorage() : new LocalStorage();
	return _storage;
}
