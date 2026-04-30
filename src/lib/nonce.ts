import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createMiddleware } from "@tanstack/react-start";

const nonceStore = new AsyncLocalStorage<string>();

export function getNonce(): string | undefined {
	return nonceStore.getStore();
}

export const nonceMiddleware = createMiddleware({ type: "request" }).server(async ({ next }) => {
	const nonce = randomBytes(16).toString("base64");
	return nonceStore.run(nonce, () => next());
});
