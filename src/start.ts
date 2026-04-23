import { createStart } from "@tanstack/react-start";
import { corsMiddleware } from "~/lib/cors";
import { loggingMiddleware } from "~/lib/log/middleware";
import { securityHeadersMiddleware } from "~/lib/security-headers";

if (typeof process !== "undefined" && !process.env.RESEND_API_KEY) {
	if (process.env.NODE_ENV === "production") {
		// biome-ignore lint/suspicious/noConsole: startup check, can't use pino here (pulls node:async_hooks into client)
		console.warn("RESEND_API_KEY is not set — emails will not be delivered");
	} else {
		// biome-ignore lint/suspicious/noConsole: startup check
		console.info("RESEND_API_KEY not set — emails will be logged to console");
	}
}

export const startInstance = createStart(() => ({
	requestMiddleware: [corsMiddleware, securityHeadersMiddleware, loggingMiddleware],
}));
