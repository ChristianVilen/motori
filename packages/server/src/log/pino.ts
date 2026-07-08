import type { Writable } from "node:stream";
import pino, { type Logger, type LoggerOptions } from "pino";

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

	// pino's `transport` spawns a worker and cannot be combined with a custom
	// destination stream. Only enable pretty when no stream was injected.
	if (pretty && !destination) {
		pinoOptions.transport = {
			target: "pino-pretty",
			options: {
				colorize: true,
				singleLine: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
			},
		};
	}

	return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export const rootLogger = createRootLogger();
