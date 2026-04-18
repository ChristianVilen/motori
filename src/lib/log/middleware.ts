import { createMiddleware } from "@tanstack/react-start";
import { withLogContext } from "./context";
import { log } from "./index";

const SLOW_REQUEST_MS = 1000;
const REQUEST_ID_SHAPE = /^[A-Za-z0-9._-]{1,128}$/;

export const loggingMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
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
