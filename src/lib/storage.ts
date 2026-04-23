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
import { z } from "zod";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
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

const MIME_EXT = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
} as const;

const uploadInputSchema = z.object({
	filename: z.string().max(255),
	contentType: z.enum(
		Object.keys(MIME_EXT) as [keyof typeof MIME_EXT, ...(keyof typeof MIME_EXT)[]],
		{ message: "Vain JPEG, PNG ja WebP tiedostot ovat sallittuja" },
	),
});

export const getImageUploadUrl = createServerFn({ method: "POST" })
	.middleware([rateLimitMiddleware(20, 60, "image-upload"), requireVerifiedEmail()])
	.inputValidator((data: unknown) => uploadInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ladataksesi kuvia");
		}
		if (!process.env.STORAGE_ENDPOINT) {
			log.event(EVENTS.image.upload_failed, { reason: "storage-not-configured" });
			throw new Error("Kuvatallennusta ei ole konfiguroitu");
		}

		try {
			const ext = MIME_EXT[data.contentType];
			const key = `listings/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
			const uploadUrl = await generatePresignedUploadUrl(key, data.contentType);
			const publicUrl = getPublicUrl(key);
			log.event(EVENTS.image.uploaded, { key, contentType: data.contentType });
			return { uploadUrl, publicUrl };
		} catch (err) {
			log.event(EVENTS.image.upload_failed, {
				reason: (err as Error).message,
			});
			throw err;
		}
	});
