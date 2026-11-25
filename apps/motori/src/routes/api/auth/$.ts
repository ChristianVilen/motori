import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { publicAuthResponse } from "~/lib/public-session-user";

const publicUserPaths = new Set([
	"/api/auth/get-session",
	"/api/auth/sign-in/email",
	"/api/auth/sign-up/email",
]);

async function handleAuth({ request }: { request: Request }) {
	const response = await auth.handler(request);
	if (!response.ok || !publicUserPaths.has(new URL(request.url).pathname.replace(/\/$/, ""))) {
		return response;
	}
	return publicAuthResponse(response);
}

export const Route = createFileRoute("/api/auth/$")({
	server: { handlers: { GET: handleAuth, POST: handleAuth } },
});
