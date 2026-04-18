import type { Logger } from "pino";
import { getLogger } from "./context";
import type { EventName } from "./events";

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

export const log = {
	debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
	info: (msg: string, fields?: Fields) => emit("info", msg, fields),
	warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
	error: (msg: string, fields?: Fields) => emit("error", msg, fields),
	event: (name: EventName, fields?: Fields) => emit("info", name, { ...fields, event: name }),
	child: (bindings: Fields): Logger => getLogger().child(bindings),
};

export { withLogContext } from "./context";
