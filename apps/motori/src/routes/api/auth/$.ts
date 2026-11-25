import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/lib/auth";
import { publicSessionUser } from "~/lib/public-session-user";

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
	const payload = await response.clone().json();
	if (!payload?.user || !("role" in payload.user) || payload.user.role === "admin") {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	headers.delete("etag");
	return Response.json(
		{ ...payload, user: publicSessionUser(payload.user) },
		{ status: response.status, headers },
	);
}

export const Route = createFileRoute("/api/auth/$")({
	server: { handlers: { GET: handleAuth, POST: handleAuth } },
});
