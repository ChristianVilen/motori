import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const nonce = (
		globalThis as { __motoriGetNonce?: () => string | undefined }
	).__motoriGetNonce?.();
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		ssr: { nonce },
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
