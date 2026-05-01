import { sql } from "kysely";
import { sendBookingAutoRejectedEmail } from "~/lib/booking-emails";
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

	if (result.length === 0) {
		return 0;
	}

	const ids = result.map((r) => r.id);
	const expired = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.innerJoin("user", "user.id", "booking.renter_user_id")
		.innerJoin("profile", "profile.user_id", "booking.renter_user_id")
		.select([
			"booking.id",
			"booking.short_id",
			sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"listing.title as listing_title",
			"user.email as renter_email",
			"profile.display_name as renter_name",
		])
		.where("booking.id", "in", ids)
		.execute();

	for (const b of expired) {
		log.event(EVENTS.booking.expired, { bookingId: b.id });
		void sendBookingAutoRejectedEmail({
			booking: {
				short_id: b.short_id,
				listing_title: b.listing_title,
				start_date: b.start_date,
				end_date: b.end_date,
			},
			renter: { display_name: b.renter_name, email: b.renter_email, phone: null },
		});
	}

	return result.length;
}
