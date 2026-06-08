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

/**
 * Build the root pino instance. Accepts an optional destination stream so tests
 * can capture output without touching process.stdout.
 *
 * Without an injected destination the logger fans out over a multistream: a
 * console sink (pino-pretty in-process when `pretty`, else stdout) and, when
 * OPENOBSERVE_URL is set server-side, the best-effort OpenObserve sink. We use
 * in-process pino-pretty rather than a worker transport because the worker
 * doesn't resolve cleanly in the bundled Nitro output.
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

	// Tests inject a destination — keep that path single-stream.
	if (destination) {
		return pino(pinoOptions, destination);
	}

	// multistream defaults each stream to `info`; pass the logger's level so
	// e.g. LOG_LEVEL=debug still reaches every sink.
	const streamLevel = level as pino.Level;
	const streams: pino.StreamEntry[] = [
		{ stream: pretty ? prettyStream(PRETTY_OPTIONS) : process.stdout, level: streamLevel },
	];
	if (typeof window === "undefined" && process.env.OPENOBSERVE_URL) {
		streams.push({
			stream: createOpenObserveStream({
				url: process.env.OPENOBSERVE_URL,
				org: process.env.OPENOBSERVE_ORG ?? "default",
				stream: process.env.OPENOBSERVE_STREAM ?? "motori",
				user: process.env.OPENOBSERVE_USER ?? "",
				password: process.env.OPENOBSERVE_PASSWORD ?? "",
			}),
			level: streamLevel,
		});
	}

	return pino(pinoOptions, pino.multistream(streams));
}

export const rootLogger = createRootLogger();
