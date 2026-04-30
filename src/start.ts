import { createStart } from "@tanstack/react-start";
import { corsMiddleware } from "~/lib/cors";
import { loggingMiddleware } from "~/lib/log/middleware";
import { nonceMiddleware } from "~/lib/nonce";
import { securityHeadersMiddleware } from "~/lib/security-headers";

export const startInstance = createStart(() => ({
	requestMiddleware: [
		corsMiddleware,
		nonceMiddleware,
		securityHeadersMiddleware,
		loggingMiddleware,
	],
}));
