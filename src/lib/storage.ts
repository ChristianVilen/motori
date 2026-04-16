// src/lib/storage.ts
// Hetzner Object Storage (S3-compatible, Helsinki hel1 datacenter)
//
// Required env vars:
//   STORAGE_ENDPOINT     e.g. https://hel1.your-objectstorage.com
//   STORAGE_BUCKET       your bucket name
//   STORAGE_ACCESS_KEY   Hetzner Object Storage access key
//   STORAGE_SECRET_KEY   Hetzner Object Storage secret key
//   STORAGE_PUBLIC_URL   public base URL for objects, e.g. https://your-bucket.hel1.your-objectstorage.com

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServerFn } from "@tanstack/react-start";
import { getSession } from "~/lib/session";

function getStorageClient() {
	return new S3Client({
		region: "hel1",
		endpoint: process.env.STORAGE_ENDPOINT,
		credentials: {
			accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
			secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
		},
		forcePathStyle: true, // required for Hetzner Object Storage
	});
}

export async function generatePresignedUploadUrl(
	key: string,
	contentType: string,
): Promise<string> {
	const client = getStorageClient();
	const command = new PutObjectCommand({
		Bucket: process.env.STORAGE_BUCKET,
		Key: key,
		ContentType: contentType,
	});
	return getSignedUrl(client, command, { expiresIn: 3600 });
}

export function getPublicUrl(key: string): string {
	const base = process.env.STORAGE_PUBLIC_URL ?? "";
	return `${base}/${key}`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const getImageUploadUrl = createServerFn({ method: "POST" })
	.inputValidator((data: { filename: string; contentType: string }) => {
		if (!ALLOWED_TYPES.includes(data.contentType)) {
			throw new Error("Vain JPEG, PNG ja WebP tiedostot ovat sallittuja");
		}
		return data;
	})
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ladataksesi kuvia");
		}
		if (!process.env.STORAGE_ENDPOINT) {
			throw new Error("Kuvatallennusta ei ole konfiguroitu");
		}

		const ext = data.filename.split(".").pop() ?? "jpg";
		const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
		const uploadUrl = await generatePresignedUploadUrl(key, data.contentType);
		const publicUrl = getPublicUrl(key);
		return { uploadUrl, publicUrl };
	});
