import { createStart } from "@tanstack/react-start";
import { corsMiddleware } from "~/lib/cors";
import { log } from "~/lib/log";
import { loggingMiddleware } from "~/lib/log/middleware";
import { securityHeadersMiddleware } from "~/lib/security-headers";

if (!process.env.RESEND_API_KEY) {
	if (process.env.NODE_ENV === "production") {
		log.warn("RESEND_API_KEY is not set — emails will not be delivered");
	} else {
		log.info("RESEND_API_KEY not set — emails will be logged to console");
	}
}

export const startInstance = createStart(() => ({
	requestMiddleware: [corsMiddleware, securityHeadersMiddleware, loggingMiddleware],
}));
