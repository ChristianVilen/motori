import fs from "node:fs";
import path from "node:path";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
	".webp": "image/webp",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
};

/**
 * Dev-only local file server for `/api/uploads/$` (used when STORAGE_ENDPOINT is
 * unset). Each app keeps a thin `createFileRoute` shell so file-based routing
 * registers it; this owns the traversal guard and MIME mapping so the security
 * check can't drift between apps.
 */
export function serveLocalUpload(splat: string | undefined): Response {
	const filePath = path.join(UPLOADS_DIR, splat ?? "");

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
}
