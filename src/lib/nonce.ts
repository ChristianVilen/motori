import { AsyncLocalStorage } from "node:async_hooks";
import { createMiddleware } from "@tanstack/react-start";

const nonceStore = new AsyncLocalStorage<string>();

export function getNonce(): string | undefined {
	return nonceStore.getStore();
}

export const nonceMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	const nonce = btoa(String.fromCharCode(...bytes));
	return nonceStore.run(nonce, () => next());
});
