import { timingSafeEqual } from "node:crypto";
import { checkRateLimit, getClientIp } from "./rate-limit";

export type CronTask = () => Promise<Record<string, unknown>>;

type CronLogger = {
	error: (msg: string, fields?: Record<string, unknown>) => void;
};

/**
 * Shared POST /api/cron handler. Rate-limits per client IP, checks the
 * CRON_SECRET Bearer token in constant time, then runs the ?task=<name> from
 * the query string, or every task in the map when none is given. A failing
 * task is logged and reported in the JSON body without stopping the remaining
 * tasks.
 */
export async function runCronTasks(
	request: Request,
	tasks: Record<string, CronTask>,
	log: CronLogger,
): Promise<Response> {
	// infra/cron/*.crontab sends at most three requests per 15 minutes, so this
	// only ever stops secret guessing; keep it above that when adding jobs.
	// Requests with no client IP share one bucket instead of skipping the limit.
	const ip = getClientIp(request) ?? "unknown";
	const { allowed, retryAfter } = checkRateLimit(`cron:${ip}`, 10, 15 * 60_000);
	if (!allowed) {
		return new Response("Too many requests", {
			status: 429,
			headers: { "Retry-After": String(retryAfter) },
		});
	}

	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return new Response("CRON_SECRET not configured", { status: 500 });
	}
	const auth = request.headers.get("authorization");
	const expected = `Bearer ${secret}`;
	if (
		!auth ||
		auth.length !== expected.length ||
		!timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
	) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(request.url);
	const task = url.searchParams.get("task");

	const taskNames = task ? [task] : Object.keys(tasks);
	const results: Record<string, unknown> = {};

	for (const name of taskNames) {
		const fn = tasks[name];
		if (!fn) {
			return new Response(`Unknown task: ${name}`, { status: 400 });
		}
		try {
			results[name] = await fn();
		} catch (err) {
			log.error(`cron: task ${name} failed`, { err });
			results[name] = { error: err instanceof Error ? err.message : String(err) };
		}
	}

	return new Response(JSON.stringify(results), {
		headers: { "content-type": "application/json" },
	});
}
