// POST /api/images/upload — multipart → sharp optimize → store (see @motori/server/image-upload).
import { handleImageUpload } from "@motori/server/image-upload";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { MAX_IMAGE_UPLOAD_BYTES } from "~/lib/constants";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

export const Route = createFileRoute("/api/images/upload")({
	server: {
		handlers: {
			POST: ({ request }) =>
				handleImageUpload(request, {
					getSession: (headers) => auth.api.getSession({ headers }),
					keyPrefix: "talli",
					rateLimitPrefix: "talli-image-upload",
					// talli validates CSRF against its OWN origin, not the auth host's.
					expectedOrigin: new URL(
						process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
					).origin,
					maxBytes: MAX_IMAGE_UPLOAD_BYTES,
					onUploaded: ({ key, originalSize, optimizedSize }) =>
						log.event(EVENTS.image.uploaded, { key, originalSize, optimizedSize }),
				}),
		},
	},
});
