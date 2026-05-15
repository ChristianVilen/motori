/**
 * Booking lifecycle — server only.
 * Owns: create → confirm → reject → cancel → expire.
 * Side effects (emails, conversation, system messages) go through an injected
 * BookingNotifier so the state machine is testable without mocking transport modules.
 */
import { sql } from "kysely";
import { type BookingNotifier, realNotifier } from "~/lib/booking-notifier";
import { expandDateRange } from "~/lib/bookings";
import { db } from "~/lib/db/index";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { generateShortId } from "~/lib/slug";

// --- Create ---

export async function createBookingRequest(
	args: {
		listingId: string;
		startDate: string;
		endDate: string;
		message: string;
		userId: string;
		userEmail: string;
	},
	notifier: BookingNotifier = realNotifier,
): Promise<{ short_id: string }> {
	const listing = await db
		.selectFrom("listing")
		.innerJoin("user", "user.id", "listing.owner_id")
		.innerJoin("profile", "profile.user_id", "listing.owner_id")
		.select([
			"listing.id",
			"listing.title",
			"listing.owner_id",
			"listing.status",
			"user.email as owner_email",
			"profile.display_name as owner_display_name",
			"profile.phone as owner_phone",
			"profile.show_phone as owner_show_phone",
			"profile.language as owner_language",
		])
		.where("listing.id", "=", args.listingId)
		.executeTakeFirst();

	if (!listing || listing.status !== "active") {
		throw new AppError("booking.listing_unavailable");
	}
	if (listing.owner_id === args.userId) {
		throw new AppError("booking.own_listing");
	}

	const renterProfile = await db
		.selectFrom("profile")
		.select(["display_name", "phone", "show_phone", "language"])
		.where("user_id", "=", args.userId)
		.executeTakeFirst();

	if (!renterProfile) {
		throw new AppError("auth.profile_missing");
	}

	const shortId = generateShortId();
	const { conversationId } = await notifier.startConversation({
		listingId: listing.id,
		userId: args.userId,
	});
	const inserted = await db.transaction().execute(async (trx) => {
		const collisions = await trx
			.selectFrom("booking")
			.select("id")
			.where("listing_id", "=", listing.id)
			.where("status", "=", "confirmed")
			.where("start_date", "<=", args.endDate)
			.where("end_date", ">=", args.startDate)
			.execute();

		if (collisions.length > 0) {
			throw new AppError("booking.dates_unavailable");
		}

		const [availRow, exceptions] = await Promise.all([
			trx
				.selectFrom("listing_rental")
				.select("availability_default")
				.where("listing_id", "=", listing.id)
				.executeTakeFirst(),
			trx
				.selectFrom("listing_availability_exception")
				.select(sql<string>`to_char(date, 'YYYY-MM-DD')`.as("date"))
				.where("listing_id", "=", listing.id)
				.execute(),
		]);

		const availDefault = availRow?.availability_default ?? "open";
		const exceptionSet = new Set(exceptions.map((e) => e.date));
		const requestedDates = expandDateRange(args.startDate, args.endDate);

		for (const date of requestedDates) {
			const inException = exceptionSet.has(date);
			const blocked = availDefault === "open" ? inException : !inException;
			if (blocked) {
				throw new AppError("booking.dates_unavailable");
			}
		}

		return trx
			.insertInto("booking")
			.values({
				short_id: shortId,
				listing_id: listing.id,
				renter_user_id: args.userId,
				start_date: args.startDate,
				end_date: args.endDate,
				message: null,
				conversation_id: conversationId,
			})
			.returning(["id", "short_id"])
			.executeTakeFirstOrThrow();
	});

	log.event(EVENTS.booking.requested, {
		bookingId: inserted.id,
		listingId: listing.id,
		renterId: args.userId,
	});

	await notifier.notifyBookingRequested({
		booking: {
			short_id: inserted.short_id,
			listing_title: listing.title,
			start_date: args.startDate,
			end_date: args.endDate,
		},
		owner: {
			display_name: listing.owner_display_name,
			email: listing.owner_email,
			phone: listing.owner_show_phone ? listing.owner_phone : null,
			language: listing.owner_language,
		},
		renter: {
			display_name: renterProfile.display_name,
			email: args.userEmail,
			phone: renterProfile.show_phone ? renterProfile.phone : null,
			language: renterProfile.language,
		},
		message: args.message,
		conversationId,
		bookingId: inserted.id,
		senderUserId: args.userId,
	});

	return { short_id: inserted.short_id };
}

// --- Confirm ---

export async function confirmBooking(
	args: {
		bookingId: string;
		userId: string;
	},
	notifier: BookingNotifier = realNotifier,
): Promise<{ autoRejectedCount: number }> {
	const result = await db.transaction().execute(async (trx) => {
		const booking = await trx
			.selectFrom("booking")
			.innerJoin("listing", "listing.id", "booking.listing_id")
			.innerJoin("user as renter_user", "renter_user.id", "booking.renter_user_id")
			.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
			.innerJoin("user as owner_user", "owner_user.id", "listing.owner_id")
			.innerJoin("profile as owner_profile", "owner_profile.user_id", "listing.owner_id")
			.select([
				"booking.id",
				"booking.short_id",
				"booking.status",
				"booking.listing_id",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"listing.title as listing_title",
				"listing.owner_id",
				"renter_user.email as renter_email",
				"renter_profile.display_name as renter_name",
				"renter_profile.language as renter_language",
				"owner_user.email as owner_email",
				"owner_profile.display_name as owner_name",
				"owner_profile.phone as owner_phone",
				"owner_profile.show_phone as owner_show_phone",
				"owner_profile.language as owner_language",
			])
			.where("booking.id", "=", args.bookingId)
			.executeTakeFirst();

		if (!booking) {
			throw new AppError("booking.not_found");
		}
		if (booking.owner_id !== args.userId) {
			throw new AppError("booking.forbidden");
		}
		if (booking.status !== "pending") {
			throw new AppError("booking.not_pending");
		}

		const confirmResult = await trx
			.updateTable("booking")
			.set({ status: "confirmed", responded_at: new Date(), updated_at: new Date() })
			.where("id", "=", booking.id)
			.where("status", "=", "pending")
			.executeTakeFirst();

		if (confirmResult.numUpdatedRows === 0n) {
			throw new AppError("booking.not_pending");
		}

		const overlaps = await trx
			.selectFrom("booking")
			.innerJoin("user", "user.id", "booking.renter_user_id")
			.innerJoin("profile", "profile.user_id", "booking.renter_user_id")
			.select([
				"booking.id",
				"booking.short_id",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"user.email",
				"profile.display_name",
				"profile.language",
			])
			.where("booking.listing_id", "=", booking.listing_id)
			.where("booking.id", "!=", booking.id)
			.where("booking.status", "=", "pending")
			.where("booking.start_date", "<=", booking.end_date)
			.where("booking.end_date", ">=", booking.start_date)
			.execute();

		if (overlaps.length > 0) {
			await trx
				.updateTable("booking")
				.set({ status: "rejected", responded_at: new Date(), updated_at: new Date() })
				.where(
					"id",
					"in",
					overlaps.map((o) => o.id),
				)
				.execute();
		}

		return { booking, overlaps };
	});

	log.event(EVENTS.booking.confirmed, { bookingId: result.booking.id });

	await notifier.notifyBookingConfirmed({
		booking: {
			short_id: result.booking.short_id,
			listing_title: result.booking.listing_title,
			start_date: result.booking.start_date,
			end_date: result.booking.end_date,
		},
		renter: {
			display_name: result.booking.renter_name,
			email: result.booking.renter_email,
			phone: null,
			language: result.booking.renter_language,
		},
		owner: {
			display_name: result.booking.owner_name,
			email: result.booking.owner_email,
			phone: result.booking.owner_show_phone ? result.booking.owner_phone : null,
			language: result.booking.owner_language,
		},
	});

	for (const o of result.overlaps) {
		log.event(EVENTS.booking.auto_rejected_overlap, {
			bookingId: o.id,
			confirmedBookingId: result.booking.id,
		});
		await notifier.notifyBookingAutoRejected({
			booking: {
				short_id: o.short_id,
				listing_title: result.booking.listing_title,
				start_date: o.start_date,
				end_date: o.end_date,
			},
			renter: { display_name: o.display_name, email: o.email, phone: null, language: o.language },
		});
	}

	return { autoRejectedCount: result.overlaps.length };
}

// --- Reject ---

export async function rejectBooking(
	args: {
		bookingId: string;
		userId: string;
		reason?: string;
	},
	notifier: BookingNotifier = realNotifier,
): Promise<void> {
	const booking = await db.transaction().execute(async (trx) => {
		const row = await trx
			.selectFrom("booking")
			.innerJoin("listing", "listing.id", "booking.listing_id")
			.innerJoin("user", "user.id", "booking.renter_user_id")
			.innerJoin("profile", "profile.user_id", "booking.renter_user_id")
			.select([
				"booking.id",
				"booking.short_id",
				"booking.status",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"listing.title as listing_title",
				"listing.owner_id",
				"user.email as renter_email",
				"profile.display_name as renter_name",
				"profile.language as renter_language",
			])
			.where("booking.id", "=", args.bookingId)
			.executeTakeFirst();

		if (!row) {
			throw new AppError("booking.not_found");
		}
		if (row.owner_id !== args.userId) {
			throw new AppError("booking.forbidden");
		}
		if (row.status !== "pending") {
			throw new AppError("booking.not_pending");
		}

		const result = await trx
			.updateTable("booking")
			.set({
				status: "rejected",
				rejection_reason: args.reason ?? null,
				responded_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", row.id)
			.where("status", "=", "pending")
			.executeTakeFirst();

		if (result.numUpdatedRows === 0n) {
			throw new AppError("booking.not_pending");
		}

		return row;
	});

	log.event(EVENTS.booking.rejected, { bookingId: booking.id });

	await notifier.notifyBookingRejected({
		booking: {
			short_id: booking.short_id,
			listing_title: booking.listing_title,
			start_date: booking.start_date,
			end_date: booking.end_date,
		},
		renter: {
			display_name: booking.renter_name,
			email: booking.renter_email,
			phone: null,
			language: booking.renter_language,
		},
		reason: args.reason ?? null,
	});
}

// --- Cancel ---

export async function cancelBooking(args: { bookingId: string; userId: string }): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const booking = await trx
			.selectFrom("booking")
			.select(["id", "renter_user_id", "status"])
			.where("id", "=", args.bookingId)
			.executeTakeFirst();

		if (!booking) {
			throw new AppError("booking.not_found");
		}
		if (booking.renter_user_id !== args.userId) {
			throw new AppError("booking.forbidden");
		}
		if (booking.status !== "pending") {
			throw new AppError("booking.not_pending");
		}

		const cancelResult = await trx
			.updateTable("booking")
			.set({ status: "cancelled", updated_at: new Date() })
			.where("id", "=", booking.id)
			.where("renter_user_id", "=", args.userId)
			.where("status", "=", "pending")
			.executeTakeFirst();

		if (cancelResult.numUpdatedRows === 0n) {
			throw new AppError("booking.not_pending");
		}
	});

	log.event(EVENTS.booking.cancelled, { bookingId: args.bookingId });
}

// --- Expire ---

/**
 * Mark pending bookings as expired when either:
 *   - they're older than 7 days with no owner response, OR
 *   - their start_date has passed.
 */
export async function expireStaleBookings(
	notifier: BookingNotifier = realNotifier,
): Promise<number> {
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
			"profile.language as renter_language",
		])
		.where("booking.id", "in", ids)
		.execute();

	for (const b of expired) {
		log.event(EVENTS.booking.expired, { bookingId: b.id });
		await notifier.notifyBookingAutoRejected({
			booking: {
				short_id: b.short_id,
				listing_title: b.listing_title,
				start_date: b.start_date,
				end_date: b.end_date,
			},
			renter: {
				display_name: b.renter_name,
				email: b.renter_email,
				phone: null,
				language: b.renter_language,
			},
		});
	}

	return result.length;
}
