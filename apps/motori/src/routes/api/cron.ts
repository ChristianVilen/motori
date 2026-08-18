import { type CronTask, runCronTasks } from "@motori/server/cron";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "kysely";
import { expireStaleBookings } from "~/lib/bookings.server";
import { log } from "~/lib/log";
import { sendListingExpiryWarnings } from "~/lib/notifications";

const TASKS: Record<string, CronTask> = {
	"purge-sessions": async () => {
		const { db } = await import("~/lib/db/index");
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
	"expire-bookings": async () => {
		const expired = await expireStaleBookings();
		log.info("cron: bookings expired", { expired });
		return { expired };
	},
	// Rental is deliberately absent: its expires_at is inert (never expires).
	"expire-listings": async () => {
		const { db } = await import("~/lib/db/index");
		const result = await db
			.updateTable("listing")
			.set({ status: "expired", updated_at: new Date() })
			.where("status", "=", "active")
			.where("category", "in", ["sale", "gear", "part"])
			.where("expires_at", "<", sql<Date>`now()`)
			.executeTakeFirst();
		const expired = Number(result.numUpdatedRows);
		log.info("cron: listings expired", { expired });
		return { expired };
	},
};

export const Route = createFileRoute("/api/cron")({
	server: {
		handlers: {
			POST: ({ request }) => runCronTasks(request, TASKS, log),
		},
	},
});
