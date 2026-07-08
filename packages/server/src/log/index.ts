import type { Logger } from "pino";
import { getLogger } from "./context";

type Fields = Record<string, unknown>;
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Fields): void {
	const logger = getLogger();
	if (fields) {
		logger[level](fields, msg);
	} else {
		logger[level](msg);
	}
}

// Each app instantiates with its own event-name union so log.event stays typed
// against that app's catalog.
export function createLog<EventName extends string>() {
	return {
		debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
		info: (msg: string, fields?: Fields) => emit("info", msg, fields),
		warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
		error: (msg: string, fields?: Fields) => emit("error", msg, fields),
		event: (name: EventName, fields?: Fields) => emit("info", name, { ...fields, event: name }),
		child: (bindings: Fields): Logger => getLogger().child(bindings),
	};
}

export { withLogContext } from "./context";
