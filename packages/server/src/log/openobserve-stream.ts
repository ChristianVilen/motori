import { Buffer } from "node:buffer";
import { Writable } from "node:stream";

export interface OpenObserveStreamConfig {
	url: string;
	org: string;
	stream: string;
	user: string;
	password: string;
	/** Flush once this many records are buffered. */
	batchSize?: number;
	/** Flush at least this often (ms). */
	flushIntervalMs?: number;
	/** During an outage, never buffer more than this many records (drop oldest). */
	maxBuffer?: number;
}

/**
 * In-process, best-effort log shipper to OpenObserve's native JSON ingest.
 * Buffers the NDJSON lines pino writes and POSTs them as a JSON array on a timer
 * or when the batch fills. Failures are swallowed (warned once to stderr): stdout
 * via Dokku is the durable source of truth, so losing the in-flight buffer on a
 * crash or OO outage is an accepted trade-off, not a bug.
 */
export function createOpenObserveStream(config: OpenObserveStreamConfig): Writable {
	const batchSize = config.batchSize ?? 100;
	const flushIntervalMs = config.flushIntervalMs ?? 5000;
	const maxBuffer = config.maxBuffer ?? 1000;
	const endpoint = `${config.url.replace(/\/$/, "")}/api/${config.org}/${config.stream}/_json`;
	const authHeader = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString("base64")}`;

	let buffer: unknown[] = [];
	let warned = false;

	async function flush(): Promise<void> {
		if (buffer.length === 0) {
			return;
		}
		const batch = buffer;
		buffer = [];
		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json", authorization: authHeader },
				body: JSON.stringify(batch),
			});
			if (res.ok) {
				warned = false;
			} else if (!warned) {
				warned = true;
				process.stderr.write(`[openobserve] ingest failed: ${res.status} ${res.statusText}\n`);
			}
		} catch (err) {
			if (!warned) {
				warned = true;
				const message = err instanceof Error ? err.message : String(err);
				process.stderr.write(`[openobserve] ingest error: ${message}\n`);
			}
		}
	}

	const timer = setInterval(() => void flush(), flushIntervalMs);
	// Never keep the process alive just for the flush timer.
	timer.unref();

	return new Writable({
		write(chunk, _enc, cb) {
			try {
				buffer.push(JSON.parse(chunk.toString()));
				if (buffer.length > maxBuffer) {
					buffer.splice(0, buffer.length - maxBuffer);
				}
				if (buffer.length >= batchSize) {
					void flush();
				}
			} catch {
				// Non-JSON line (shouldn't happen via pino) — skip it.
			}
			cb();
		},
		final(cb) {
			// Best-effort flush on a clean stream end.
			void flush().finally(() => cb());
		},
	});
}
