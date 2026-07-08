import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";

// CSRF protection for POST server functions.
// TanStack Start calls server functions via fetch() which sends an Origin header.
// We reject POST requests where Origin doesn't match the expected base URL.
// This blocks cross-site form submissions and cross-origin fetch (CORS already
// blocks the latter, but defense-in-depth is cheap).
//
// NOTE: SSR server-function-to-server-function calls (e.g. a loader calling a
// POST server function) may not send an Origin header. Currently safe because
// all POST server functions are only called from client-side event handlers,
// never from loaders or other server functions. If that changes, this middleware
// must allowlist missing Origin for same-process calls.
// APP_ORIGIN lets a non-auth-hosting app (talli) validate against its own origin.

export function csrfMiddleware() {
	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const request = getRequest();
		if (request.method !== "POST") {
			return next();
		}

		const origin = request.headers.get("origin");
		const expected = new URL(
			process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
		).origin;

		if (!origin || origin !== expected) {
			setResponseStatus(403);
			throw new Error("CSRF validation failed");
		}

		return next();
	});
}
