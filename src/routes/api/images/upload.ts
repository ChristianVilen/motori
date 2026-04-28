// src/routes/api/images/upload.ts
// POST /api/images/upload — receives multipart file, optimizes with sharp, stores via abstraction.

import { createFileRoute } from "@tanstack/react-router";
import sharp from "sharp";
import { auth } from "~/lib/auth";
import { getImageStorage } from "~/lib/image-storage";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB raw input
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TARGET_WIDTH = 1600;
const THUMB_WIDTH = 400;

function jsonError(error: string, status: number) {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export const Route = createFileRoute("/api/images/upload")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// ── Auth ────────────────────────────────────────────────────
				const session = await auth.api.getSession({ headers: request.headers });
				if (!session) {
					return jsonError("Kirjaudu sisään", 401);
				}

				// ── Email verification ──────────────────────────────────────
				if (!session.user.emailVerified) {
					return jsonError("Vahvista sähköpostiosoitteesi ensin", 403);
				}

				// ── CSRF ───────────────────────────────────────────────────
				const origin = request.headers.get("origin");
				const expected = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
				if (!origin || origin !== expected) {
					return jsonError("CSRF validation failed", 403);
				}

				// ── Rate limit ─────────────────────────────────────────────
				const ip = getClientIp(request);
				if (ip) {
					const { allowed, retryAfter } = checkRateLimit(`image-upload:${ip}`, 20, 60_000);
					if (!allowed) {
						return new Response(
							JSON.stringify({ error: `Liian monta latausta. Yritä ${retryAfter}s kuluttua.` }),
							{
								status: 429,
								headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
							},
						);
					}
				}

				// ── Parse multipart ────────────────────────────────────────
				const formData = await request.formData();
				const file = formData.get("file");
				if (!(file instanceof File)) {
					return jsonError("Tiedosto puuttuu", 400);
				}
				if (!ALLOWED_TYPES.has(file.type)) {
					return jsonError("Vain JPEG, PNG ja WebP sallittu", 400);
				}
				if (file.size > MAX_FILE_SIZE) {
					return jsonError("Tiedosto on liian suuri (max 10 MB)", 400);
				}

				// ── Optimize ───────────────────────────────────────────────
				const raw = Buffer.from(await file.arrayBuffer());
				const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
				const key = `listings/${session.user.id}/${id}.webp`;
				const thumbKey = `listings/${session.user.id}/${id}_thumb.webp`;

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

				// ── Store ──────────────────────────────────────────────────
				const storage = getImageStorage();
				const [url, thumbnailUrl] = await Promise.all([
					storage.upload(optimized, key, "image/webp"),
					storage.upload(thumbnail, thumbKey, "image/webp"),
				]);

				log.event(EVENTS.image.uploaded, {
					key,
					originalSize: file.size,
					optimizedSize: optimized.length,
				});

				return new Response(JSON.stringify({ url, thumbnailUrl }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
