/**
 * Review lifecycle — server only.
 * Submit reviews, query revealed reviews, and get review status for bookings.
 */
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { isReviewRevealed, isReviewWindowOpen } from "~/lib/reviews";

export async function submitReview(args: {
	bookingId: string;
	userId: string;
	rating: number;
	comment?: string;
}): Promise<void> {
	const booking = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.select([
			"booking.id",
			"booking.status",
			"booking.renter_user_id",
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"listing.owner_id",
		])
		.where("booking.id", "=", args.bookingId)
		.executeTakeFirst();

	if (!booking) {
		throw new Error("Varaus ei löytynyt");
	}
	if (booking.status !== "confirmed") {
		throw new Error("Varaus ei ole vahvistettu");
	}

	const isRenter = booking.renter_user_id === args.userId;
	const isOwner = booking.owner_id === args.userId;
	if (!isRenter && !isOwner) {
		throw new Error("Ei oikeuksia");
	}

	// toISOString() returns UTC date — both today and end_date are UTC-anchored (YYYY-MM-DD)
	const today = new Date().toISOString().slice(0, 10);
	if (booking.end_date >= today) {
		throw new Error("Vuokra-aika ei ole päättynyt");
	}
	if (!isReviewWindowOpen(booking.end_date)) {
		throw new Error("Arvosteluaika on umpeutunut");
	}

	const targetUserId = isRenter ? booking.owner_id : booking.renter_user_id;

	try {
		await db
			.insertInto("review")
			.values({
				booking_id: args.bookingId,
				reviewer_id: args.userId,
				target_user_id: targetUserId,
				rating: args.rating,
				comment: args.comment || null,
			})
			.execute();
	} catch (err) {
		// 23505 = unique_violation. User already reviewed this booking — idempotent no-op.
		if ((err as { code?: string })?.code === "23505") {
			return;
		}
		throw err;
	}

	log.event(EVENTS.review.submitted, { bookingId: args.bookingId, reviewerId: args.userId });
}

export interface ReviewForDisplay {
	id: string;
	rating: number;
	comment: string | null;
	created_at: Date;
	reviewer_display_name: string;
}

// SQL coverage for getReviewsForUser / getReviewSummaryForUser lives in
// e2e/tests/reviews.spec.ts — the unit tests in this file mock Kysely and
// cannot exercise the real reveal predicates.
export async function getReviewsForUser(targetUserId: string): Promise<ReviewForDisplay[]> {
	const rows = await db
		.selectFrom("review")
		.innerJoin("booking", "booking.id", "review.booking_id")
		.innerJoin("profile", "profile.user_id", "review.reviewer_id")
		.select([
			"review.id",
			"review.rating",
			"review.comment",
			"review.created_at",
			"profile.display_name as reviewer_display_name",
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			sql<number>`(SELECT count(*) FROM review r2 WHERE r2.booking_id = review.booking_id)::int`.as(
				"booking_review_count",
			),
		])
		.where("review.target_user_id", "=", targetUserId)
		.orderBy("review.created_at", "desc")
		.execute();

	return rows
		.filter((r) => isReviewRevealed(r.booking_review_count >= 2, r.end_date))
		.map((r) => ({
			id: r.id,
			rating: r.rating,
			comment: r.comment,
			created_at: r.created_at,
			reviewer_display_name: r.reviewer_display_name,
		}));
}

export interface ReviewSummary {
	averageRating: number | null;
	reviewCount: number;
}

/** Pure computation — derive summary from an already-fetched reviews array. */
export function computeReviewSummary(reviews: ReviewForDisplay[]): ReviewSummary {
	if (reviews.length === 0) {
		return { averageRating: null, reviewCount: 0 };
	}
	const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
	return {
		averageRating: Math.round((sum / reviews.length) * 10) / 10,
		reviewCount: reviews.length,
	};
}

/**
 * Aggregate-only summary — single round trip, avoids loading the full
 * reviews list when only the badge is needed (listing detail / profile header).
 * Applies the same reveal logic as getReviewsForUser.
 */
export async function getReviewSummaryForUser(targetUserId: string): Promise<ReviewSummary> {
	// Cutoff date matches isReviewRevealed: deadline passed when end_date <= today_utc - 14
	const today = new Date().toISOString().slice(0, 10);
	const cutoff = new Date(`${today}T00:00:00Z`);
	cutoff.setUTCDate(cutoff.getUTCDate() - 14);
	const cutoffStr = cutoff.toISOString().slice(0, 10);

	const row = await db
		.selectFrom("review")
		.innerJoin("booking", "booking.id", "review.booking_id")
		.select([
			sql<number | null>`avg(review.rating)::float`.as("avg_rating"),
			sql<number>`count(*)::int`.as("review_count"),
		])
		.where("review.target_user_id", "=", targetUserId)
		.where(
			sql<boolean>`((SELECT count(*) FROM review r2 WHERE r2.booking_id = review.booking_id) >= 2 OR booking.end_date <= ${cutoffStr}::date)`,
		)
		.executeTakeFirst();

	if (!row || row.review_count === 0 || row.avg_rating === null) {
		return { averageRating: null, reviewCount: 0 };
	}
	return {
		averageRating: Math.round(row.avg_rating * 10) / 10,
		reviewCount: row.review_count,
	};
}

export interface ReviewStatus {
	userHasReviewed: boolean;
	windowOpen: boolean;
}

export async function getReviewStatusForBooking(
	bookingId: string,
	userId: string,
	endDate: string,
): Promise<ReviewStatus> {
	const reviews = await db
		.selectFrom("review")
		.select(["reviewer_id"])
		.where("booking_id", "=", bookingId)
		.execute();

	const userHasReviewed = reviews.some((r) => r.reviewer_id === userId);

	return {
		userHasReviewed,
		windowOpen: isReviewWindowOpen(endDate),
	};
}
