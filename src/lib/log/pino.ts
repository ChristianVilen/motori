import type { Writable } from "node:stream";
import pino, { type Logger, type LoggerOptions } from "pino";
import prettyStream from "pino-pretty";
import { createOpenObserveStream } from "./openobserve-stream";

export const REDACT_PATHS = [
	"req.headers.authorization",
	"req.headers.cookie",
	'req.headers["set-cookie"]',
	'res.headers["set-cookie"]',
	"*.email",
	"*.phone",
	"*.password",
	"*.passwordHash",
	"*.token",
	"*.sessionToken",
	"*.ip",
];

export interface RootLoggerOptions {
	isProd?: boolean;
	level?: LoggerOptions["level"];
	/** Forces pino-pretty on or off. Defaults to `!isProd`. */
	pretty?: boolean;
}

const PRETTY_OPTIONS = {
	colorize: true,
	singleLine: true,
	translateTime: "HH:MM:ss.l",
	ignore: "pid,hostname",
};

// Optional OpenObserve sink — enabled when OPENOBSERVE_URL is set (prod, or an
// opt-in local OO container) and we are server-side. Uses an in-process
// multistream (NOT a pino worker transport, which doesn't resolve cleanly in
// the bundled Nitro output). The default (no-OO) path below is left untouched.
function buildOpenObserveMultistream(pinoOptions: LoggerOptions, pretty: boolean): Logger {
	// multistream defaults each stream to `info`; pass the logger's level so
	// e.g. LOG_LEVEL=debug still reaches both the console and OpenObserve.
	const level = pinoOptions.level as pino.LevelWithSilentOrString;
	const consoleStream: Writable = pretty
		? (prettyStream(PRETTY_OPTIONS) as unknown as Writable)
		: process.stdout;
	const ooStream = createOpenObserveStream({
		url: process.env.OPENOBSERVE_URL as string,
		org: process.env.OPENOBSERVE_ORG ?? "default",
		stream: process.env.OPENOBSERVE_STREAM ?? "motori",
		user: process.env.OPENOBSERVE_USER ?? "",
		password: process.env.OPENOBSERVE_PASSWORD ?? "",
	});
	return pino(
		pinoOptions,
		pino.multistream([
			{ stream: consoleStream, level },
			{ stream: ooStream, level },
		]),
	);
}

/**
 * Build the root pino instance. Accepts an optional destination stream so tests
 * can capture output without touching process.stdout.
 */
export function createRootLogger(opts: RootLoggerOptions = {}, destination?: Writable): Logger {
	const isProd = opts.isProd ?? process.env.NODE_ENV === "production";
	const level = opts.level ?? process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");
	const pretty = opts.pretty ?? !isProd;

	const pinoOptions: LoggerOptions = {
		level,
		timestamp: pino.stdTimeFunctions.isoTime,
		redact: isProd ? { paths: REDACT_PATHS, censor: "[REDACTED]" } : undefined,
	};

	if (!destination && typeof window === "undefined" && !!process.env.OPENOBSERVE_URL) {
		return buildOpenObserveMultistream(pinoOptions, pretty);
	}

	// pino's `transport` spawns a worker and cannot be combined with a custom
	// destination stream. Only enable pretty when no stream was injected.
	if (pretty && !destination) {
		pinoOptions.transport = {
			target: "pino-pretty",
			options: PRETTY_OPTIONS,
		};
	}

	return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export const rootLogger = createRootLogger();
