import { timingSafeEqual } from "node:crypto";

export type CronTask = () => Promise<Record<string, unknown>>;

type CronLogger = {
	error: (msg: string, fields?: Record<string, unknown>) => void;
};

/**
 * Shared POST /api/cron handler. Checks the CRON_SECRET Bearer token in
 * constant time, then runs the ?task=<name> from the query string, or every
 * task in the map when none is given. A failing task is logged and reported
 * in the JSON body without stopping the remaining tasks.
 */
export async function runCronTasks(
	request: Request,
	tasks: Record<string, CronTask>,
	log: CronLogger,
): Promise<Response> {
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
			results[name] = { error: (err as Error).message };
		}
	}

	return new Response(JSON.stringify(results), {
		headers: { "content-type": "application/json" },
	});
}
