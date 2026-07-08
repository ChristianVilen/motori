// src/routes/api/images/upload.ts
// POST /api/images/upload — receives multipart file, optimizes with sharp, stores via abstraction.

import { optimizeAndUpload } from "@motori/server/image-storage";
import { checkRateLimit, getClientIp } from "@motori/server/rate-limit";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { MAX_IMAGE_UPLOAD_BYTES } from "~/lib/constants";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
				if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
					return jsonError("Tiedosto on liian suuri (max 10 MB)", 400);
				}

				// ── Optimize + store ───────────────────────────────────────
				const raw = Buffer.from(await file.arrayBuffer());
				const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
				const key = `listings/${session.user.id}/${id}.webp`;
				const thumbKey = `listings/${session.user.id}/${id}_thumb.webp`;

				const { url, thumbnailUrl, optimizedSize } = await optimizeAndUpload(raw, key, thumbKey);

				log.event(EVENTS.image.uploaded, {
					key,
					originalSize: file.size,
					optimizedSize,
				});

				return new Response(JSON.stringify({ url, thumbnailUrl }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
		},
	},
});
