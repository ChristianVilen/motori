import { createRouter } from "@tanstack/react-router";
import { installFeedMotion } from "./lib/feed-motion";
import { installPhotoTransitions } from "./lib/listing-photo-transition";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	let nonce = (globalThis as { __motoriGetNonce?: () => string | undefined }).__motoriGetNonce?.();

	if (typeof document !== "undefined") {
		const meta = document.querySelector('meta[name="csp-nonce"]');
		if (meta) {
			nonce = meta.getAttribute("content") || undefined;
		}
	}

	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		ssr: { nonce },
	});

	if (typeof document !== "undefined") {
		installPhotoTransitions(router);
		installFeedMotion(router);
	}
	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
