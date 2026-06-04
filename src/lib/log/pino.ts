import type { Writable } from "node:stream";
import pino, { type Logger, type LoggerOptions, type TransportTargetOptions } from "pino";

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
 * Build the pino transport from the active targets. pino's `transport` spawns a worker
 * and cannot be combined with a custom destination stream, so callers pass `undefined`
 * targets (tests, which inject a stream) to skip transports entirely.
 */
function buildTransport(pretty: boolean, lokiUrl: string | undefined): LoggerOptions["transport"] {
	const targets: TransportTargetOptions[] = [];
	if (pretty) {
		targets.push({
			target: "pino-pretty",
			options: {
				colorize: true,
				singleLine: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
			},
		});
	}
	if (lokiUrl) {
		// pino-loki derives a text `level` label automatically (matching the prod Promtail
		// labels). replaceTimestamp is required because our `time` is an ISO string, which
		// pino-loki otherwise mis-serializes. silenceErrors keeps the dev console clean
		// while Loki is still starting.
		targets.push({
			target: "pino-loki",
			options: {
				host: lokiUrl,
				batching: true,
				interval: 5,
				replaceTimestamp: true,
				silenceErrors: true,
				labels: { app: "motori" },
			},
		});
	}
	if (targets.length === 0) return undefined;
	if (targets.length === 1) return targets[0];
	return { targets };
}

/**
 * Build the root pino instance. Accepts an optional destination stream so tests
 * can capture output without touching process.stdout.
 */
export function createRootLogger(opts: RootLoggerOptions = {}, destination?: Writable): Logger {
	const isProd = opts.isProd ?? process.env.NODE_ENV === "production";
	const level = opts.level ?? process.env.LOG_LEVEL ?? (isProd ? "info" : "debug");
	const pretty = opts.pretty ?? !isProd;
	// Dev-only direct push to a local Loki (prod ships via Promtail instead). pino-loki
	// is a devDependency and is only required when this target is added.
	const lokiUrl = isProd ? undefined : process.env.LOKI_URL;

	const pinoOptions: LoggerOptions = {
		level,
		timestamp: pino.stdTimeFunctions.isoTime,
		redact: isProd ? { paths: REDACT_PATHS, censor: "[REDACTED]" } : undefined,
		transport: destination ? undefined : buildTransport(pretty, lokiUrl),
	};

	return destination ? pino(pinoOptions, destination) : pino(pinoOptions);
}

export const rootLogger = createRootLogger();
