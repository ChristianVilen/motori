import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { createSecurityHeadersMiddleware } from "@motori/server/security-headers";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { MOTORI_URL } from "~/lib/constants";

// Defense-in-depth on top of the per-mutation csrfMiddleware in protectedMutation:
// rejects cross-site server-fn calls even for a fn that forgets to opt in.
// Last in the chain so rejections still get logged by loggingMiddleware.
const serverFnCsrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

// allowWasm: the document scanner runs OpenCV.js (WebAssembly), which prod CSP
// blocks without 'wasm-unsafe-eval'.
// connectSrc: talli mounts no auth routes, so sign-out fetches motori cross-origin.
export const startInstance = createStart(() => ({
	requestMiddleware: [
		nonceMiddleware,
		createSecurityHeadersMiddleware({ allowWasm: true, connectSrc: [MOTORI_URL] }),
		loggingMiddleware,
		serverFnCsrfMiddleware,
	],
}));
