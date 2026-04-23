import { createStart } from "@tanstack/react-start";
import { corsMiddleware } from "~/lib/cors";
import { loggingMiddleware } from "~/lib/log/middleware";
import { securityHeadersMiddleware } from "~/lib/security-headers";

export const startInstance = createStart(() => ({
	requestMiddleware: [corsMiddleware, securityHeadersMiddleware, loggingMiddleware],
}));
