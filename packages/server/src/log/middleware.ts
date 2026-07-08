import { createMiddleware } from "@tanstack/react-start";
import { getRequestId, withLogContext } from "./context";
import { createLog } from "./index";

const SLOW_REQUEST_MS = 1000;
const REQUEST_ID_SHAPE = /^[A-Za-z0-9._-]{1,128}$/;

// This middleware never calls `.event()`, so no app-specific event-name union
// is needed here — `string` keeps createLog's typed factory shape without
// coupling the package to an app's event catalog.
const log = createLog<string>();

export const loggingMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		// Expose getRequestId to client-reachable code (the 500 page reads it via this
		// globalThis side channel — same pattern as src/lib/nonce.ts). Registered inside the
		// .server callback (stripped from the client) so the log context, which imports
		// node:async_hooks at module top level, never enters the client bundle.
		(globalThis as { __motoriGetRequestId?: () => string | undefined }).__motoriGetRequestId ??=
			getRequestId;

		const url = new URL(request.url);
		const method = request.method;
		const path = url.pathname;
		const incoming = request.headers.get("x-request-id");
		const requestId = incoming && REQUEST_ID_SHAPE.test(incoming) ? incoming : crypto.randomUUID();

		const bindings: Record<string, unknown> = { requestId, method, path };
		const start = Date.now();

		return withLogContext(bindings, async () => {
			try {
				const result = await next();
				const durationMs = Date.now() - start;
				const status = result.response.status;
				const fields = { status, durationMs };
				if (durationMs > SLOW_REQUEST_MS) {
					log.warn("request", fields);
				} else {
					log.info("request", fields);
				}
				result.response.headers.set("x-request-id", requestId);
				return result;
			} catch (err) {
				const durationMs = Date.now() - start;
				log.error("request failed", { err, durationMs });
				// Framework generates the error response; no handle to attach
				// x-request-id. Correlate via the logged requestId instead.
				throw err;
			}
		});
	},
);
