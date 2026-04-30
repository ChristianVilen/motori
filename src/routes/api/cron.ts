import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";
import { sendListingExpiryWarnings } from "~/lib/notifications";

const TASKS: Record<string, () => Promise<Record<string, unknown>>> = {
	"purge-sessions": async () => {
		const result = await db
			.deleteFrom("session")
			.where("expiresAt", "<", sql<Date>`now()`)
			.executeTakeFirst();
		const deleted = Number(result.numDeletedRows);
		log.info("cron: expired sessions purged", { deleted });
		return { deleted };
	},
	"notify-expiry": async () => {
		const sent = await sendListingExpiryWarnings();
		log.info("cron: expiry warnings complete", { sent });
		return { sent };
	},
};

export const Route = createFileRoute("/api/cron")({
	server: {
		handlers: {
			POST: async ({ request }) => {
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

				const taskNames = task ? [task] : Object.keys(TASKS);
				const results: Record<string, unknown> = {};

				for (const name of taskNames) {
					const fn = TASKS[name];
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
			},
		},
	},
});
