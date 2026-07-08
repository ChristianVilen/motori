import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { rootLogger as defaultRoot } from "./pino";

const storage = new AsyncLocalStorage<Logger>();
let rootLogger: Logger = defaultRoot;

export function getLogger(): Logger {
	return storage.getStore() ?? rootLogger;
}

/** The current request's id, read from the active log context bindings. */
export function getRequestId(): string | undefined {
	return getLogger().bindings().requestId as string | undefined;
}

export function withLogContext<T>(
	bindings: Record<string, unknown>,
	fn: () => Promise<T> | T,
): Promise<T> {
	const child = getLogger().child(bindings);
	return Promise.resolve(storage.run(child, fn));
}

/** Test-only: swap the root logger so tests can capture output. */
export function __setRootLoggerForTest(logger: Logger): void {
	rootLogger = logger;
}
