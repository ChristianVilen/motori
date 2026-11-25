// src/routes/api/auth/$.ts
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";

import { publicSessionUser } from "~/lib/public-session-user";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const response = await auth.handler(request);
				if (!response.ok || new URL(request.url).pathname !== "/api/auth/get-session") {
					return response;
				}
				const session = await response.clone().json();
				if (!session?.user || session.user.role === "admin" || !("role" in session.user)) {
					return response;
				}
				const headers = new Headers(response.headers);
				headers.delete("content-length");
				headers.delete("etag");
				return Response.json(
					{ ...session, user: publicSessionUser(session.user) },
					{ status: response.status, headers },
				);
			},
			POST: ({ request }) => auth.handler(request),
		},
	},
});
