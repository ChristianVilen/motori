import { createMiddleware } from "@tanstack/react-start";

// Lazily import node:async_hooks so this module is safe to evaluate in client
// bundles (Vite stubs node:async_hooks to {}, so a top-level `new
// AsyncLocalStorage()` would crash). The .server() middleware below is
// stripped from the client, so the lazy import only runs server-side.
type ALS<T> = { getStore(): T | undefined; run<R>(store: T, cb: () => R): R };
let nonceStore: ALS<string> | undefined;

async function getStore(): Promise<ALS<string>> {
	if (!nonceStore) {
		const { AsyncLocalStorage } = await import("node:async_hooks");
		nonceStore = new AsyncLocalStorage<string>();
	}
	return nonceStore;
}

export function getNonce(): string | undefined {
	return nonceStore?.getStore();
}

if (typeof window === "undefined") {
	(globalThis as { __motoriGetNonce?: () => string | undefined }).__motoriGetNonce = getNonce;
}

export const nonceMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
	const store = await getStore();
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	const nonce = btoa(String.fromCharCode(...bytes));
	return store.run(nonce, () => next());
});
