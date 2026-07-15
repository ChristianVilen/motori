import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { createSecurityHeadersMiddleware } from "@motori/server/security-headers";
import { createStart } from "@tanstack/react-start";

// allowWasm: the document scanner runs OpenCV.js (WebAssembly), which prod CSP
// blocks without 'wasm-unsafe-eval'.
export const startInstance = createStart(() => ({
	requestMiddleware: [
		nonceMiddleware,
		createSecurityHeadersMiddleware({ allowWasm: true }),
		loggingMiddleware,
	],
}));
