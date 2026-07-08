import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { securityHeadersMiddleware } from "@motori/server/security-headers";
import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
	requestMiddleware: [nonceMiddleware, securityHeadersMiddleware, loggingMiddleware],
}));
