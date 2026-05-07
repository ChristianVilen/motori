import { createStart } from "@tanstack/react-start";
import { apexRedirectMiddleware } from "~/lib/apex-redirect";
import { corsMiddleware } from "~/lib/cors";
import { loggingMiddleware } from "~/lib/log/middleware";
import { nonceMiddleware } from "~/lib/nonce";
import { securityHeadersMiddleware } from "~/lib/security-headers";

export const startInstance = createStart(() => ({
	requestMiddleware: [
		apexRedirectMiddleware,
		corsMiddleware,
		nonceMiddleware,
		securityHeadersMiddleware,
		loggingMiddleware,
	],
}));
