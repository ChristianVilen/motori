// GET /api/uploads/$ — dev-only local file server (see @motori/server/uploads-route).
import { serveLocalUpload } from "@motori/server/uploads-route";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/uploads/$")({
	server: {
		handlers: {
			GET: async ({ params }) => serveLocalUpload(params._splat),
		},
	},
});
