import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { securityHeadersMiddleware } from "@motori/server/security-headers";
import { createStart } from "@tanstack/react-start";
import { apexRedirectMiddleware } from "~/lib/apex-redirect";
import { corsMiddleware } from "~/lib/cors";

export const startInstance = createStart(() => ({
	requestMiddleware: [
		apexRedirectMiddleware,
		corsMiddleware,
		nonceMiddleware,
		securityHeadersMiddleware,
		loggingMiddleware,
	],
}));
