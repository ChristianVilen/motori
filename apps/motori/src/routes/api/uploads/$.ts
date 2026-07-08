// src/routes/api/uploads/$.ts
// Serves files from /uploads/ directory in local dev mode.

import fs from "node:fs";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
	".webp": "image/webp",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
};

export const Route = createFileRoute("/api/uploads/$")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const filePath = path.join(UPLOADS_DIR, params._splat ?? "");

				// Prevent directory traversal
				if (!filePath.startsWith(UPLOADS_DIR)) {
					return new Response("Forbidden", { status: 403 });
				}

				try {
					const data = fs.readFileSync(filePath);
					const ext = path.extname(filePath).toLowerCase();
					const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

					return new Response(data, {
						headers: {
							"Content-Type": contentType,
							"Content-Length": String(data.length),
							"Cache-Control": "public, max-age=31536000, immutable",
						},
					});
				} catch {
					return new Response("Not found", { status: 404 });
				}
			},
		},
	},
});
