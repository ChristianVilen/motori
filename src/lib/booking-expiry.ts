import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

/**
 * Mark pending bookings as expired when either:
 *   - they're older than 7 days with no owner response, OR
 *   - their start_date has passed.
 */
export async function expireStaleBookings(): Promise<number> {
	const result = await db
		.updateTable("booking")
		.set({ status: "expired", updated_at: new Date() })
		.where("status", "=", "pending")
		.where((eb) =>
			eb.or([
				eb("created_at", "<", sql<Date>`now() - interval '7 days'`),
				eb("start_date", "<", sql<string>`current_date`),
			]),
		)
		.returning(["id"])
		.execute();

	for (const r of result) {
		log.event(EVENTS.booking.expired, { bookingId: r.id });
	}

	return result.length;
}
