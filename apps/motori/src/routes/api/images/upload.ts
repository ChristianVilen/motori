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
					keyPrefix: "listings",
					rateLimitPrefix: "image-upload",
					expectedOrigin: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin,
					maxBytes: MAX_IMAGE_UPLOAD_BYTES,
					onUploaded: ({ key, originalSize, optimizedSize }) =>
						log.event(EVENTS.image.uploaded, { key, originalSize, optimizedSize }),
				}),
		},
	},
});
