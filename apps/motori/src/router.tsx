import { createRouter, defaultParseSearch } from "@tanstack/react-router";
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
		parseSearch: (searchStr) => {
			const search = defaultParseSearch(searchStr);
			if ("ilmoitus" in search && typeof search.ilmoitus === "number") {
				return { ...search, ilmoitus: new URLSearchParams(searchStr).get("ilmoitus") ?? undefined };
			}
			return search;
		},
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
