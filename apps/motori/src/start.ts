import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { securityHeadersMiddleware } from "@motori/server/security-headers";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { apexRedirectMiddleware } from "~/lib/apex-redirect";
import { corsMiddleware } from "~/lib/cors";

// Defense-in-depth on top of the per-mutation csrfMiddleware in protectedMutation:
// rejects cross-site server-fn calls even for a fn that forgets to opt in.
// Last in the chain so rejections still get logged by loggingMiddleware.
const serverFnCsrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
	requestMiddleware: [
		apexRedirectMiddleware,
		corsMiddleware,
		nonceMiddleware,
		securityHeadersMiddleware,
		loggingMiddleware,
		serverFnCsrfMiddleware,
	],
}));
