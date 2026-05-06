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

	const today = new Date().toISOString().slice(0, 10);
	if (booking.end_date >= today) {
		throw new Error("Vuokra-aika ei ole päättynyt");
	}
	if (!isReviewWindowOpen(booking.end_date)) {
		throw new Error("Arvosteluaika on umpeutunut");
	}

	const targetUserId = isRenter ? booking.owner_id : booking.renter_user_id;

	await db
		.insertInto("review")
		.values({
			booking_id: args.bookingId,
			reviewer_id: args.userId,
			target_user_id: targetUserId,
			rating: args.rating,
			comment: args.comment?.trim() || null,
		})
		.execute();

	log.event(EVENTS.review.submitted, { bookingId: args.bookingId, reviewerId: args.userId });
}

export interface ReviewForDisplay {
	id: string;
	rating: number;
	comment: string | null;
	created_at: Date;
	reviewer_display_name: string;
}

export async function getReviewsForUser(targetUserId: string): Promise<ReviewForDisplay[]> {
	const reviews = await db
		.selectFrom("review")
		.innerJoin("booking", "booking.id", "review.booking_id")
		.innerJoin("profile", "profile.user_id", "review.reviewer_id")
		.select([
			"review.id",
			"review.booking_id",
			"review.rating",
			"review.comment",
			"review.created_at",
			"profile.display_name as reviewer_display_name",
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
		])
		.where("review.target_user_id", "=", targetUserId)
		.orderBy("review.created_at", "desc")
		.execute();

	// Filter to only revealed reviews
	const bookingIds = [...new Set(reviews.map((r) => r.booking_id))];
	if (bookingIds.length === 0) {
		return [];
	}

	const reviewCounts = await db
		.selectFrom("review")
		.select(["booking_id", sql<number>`count(*)::int`.as("cnt")])
		.where("booking_id", "in", bookingIds)
		.groupBy("booking_id")
		.execute();

	const countMap = new Map(reviewCounts.map((r) => [r.booking_id, r.cnt]));

	return reviews
		.filter((r) => {
			const bothSubmitted = (countMap.get(r.booking_id) ?? 0) >= 2;
			return isReviewRevealed(bothSubmitted, r.end_date);
		})
		.map(({ booking_id: _, end_date: __, ...rest }) => rest);
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

export interface ReviewStatus {
	userHasReviewed: boolean;
	counterpartyHasReviewed: boolean;
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
	const counterpartyHasReviewed = reviews.some((r) => r.reviewer_id !== userId);

	return {
		userHasReviewed,
		counterpartyHasReviewed,
		windowOpen: isReviewWindowOpen(endDate),
	};
}
