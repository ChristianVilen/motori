import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Queue-based DB mock ---

const executeQueue: unknown[] = [];
const executeTakeFirstQueue: unknown[] = [];

function chainable(): unknown {
	return new Proxy(
		{},
		{
			get(_, prop) {
				if (prop === "execute") {
					return () => executeQueue.shift();
				}
				if (prop === "executeTakeFirst") {
					return () => executeTakeFirstQueue.shift();
				}
				return () => chainable();
			},
		},
	);
}

vi.mock("~/lib/db/index", () => ({
	db: {
		selectFrom: () => chainable(),
		insertInto: () => chainable(),
	},
}));

vi.mock("~/lib/log", () => ({
	log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/lib/log/events", () => ({
	EVENTS: {
		review: {
			submitted: "review.submitted",
		},
	},
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

import { computeReviewSummary, getReviewStatusForBooking, submitReview } from "./reviews.server";

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-05-06T12:00:00Z"));
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
});

afterEach(() => {
	vi.useRealTimers();
});

// --- submitReview ---

describe("submitReview", () => {
	const booking = {
		id: "booking-1",
		status: "confirmed",
		renter_user_id: "renter-1",
		end_date: "2026-05-05", // yesterday
		owner_id: "owner-1",
	};

	it("throws when booking not found", async () => {
		executeTakeFirstQueue.push(null);

		await expect(
			submitReview({ bookingId: "booking-1", userId: "renter-1", rating: 5 }),
		).rejects.toThrow(/booking\.not_found/);
	});

	it("throws when booking is not confirmed", async () => {
		executeTakeFirstQueue.push({ ...booking, status: "pending" });

		await expect(
			submitReview({ bookingId: "booking-1", userId: "renter-1", rating: 5 }),
		).rejects.toThrow(/review\.booking_not_confirmed/);
	});

	it("throws when user is neither renter nor owner", async () => {
		executeTakeFirstQueue.push(booking);

		await expect(
			submitReview({ bookingId: "booking-1", userId: "stranger-1", rating: 5 }),
		).rejects.toThrow(/booking\.forbidden/);
	});

	it("throws when end_date has not passed", async () => {
		executeTakeFirstQueue.push({ ...booking, end_date: "2026-05-10" }); // future

		await expect(
			submitReview({ bookingId: "booking-1", userId: "renter-1", rating: 5 }),
		).rejects.toThrow(/review\.rental_not_ended/);
	});

	it("throws when review window closed (14 days after end)", async () => {
		executeTakeFirstQueue.push({ ...booking, end_date: "2026-04-21" }); // >14 days ago

		await expect(
			submitReview({ bookingId: "booking-1", userId: "renter-1", rating: 5 }),
		).rejects.toThrow(/review\.window_closed/);
	});

	it("submits review for renter (target is owner)", async () => {
		executeTakeFirstQueue.push(booking);
		executeQueue.push(undefined); // insertInto

		await submitReview({ bookingId: "booking-1", userId: "renter-1", rating: 5 });

		expect(executeTakeFirstQueue).toHaveLength(0);
		expect(executeQueue).toHaveLength(0);
	});

	it("submits review for owner (target is renter)", async () => {
		executeTakeFirstQueue.push(booking);
		executeQueue.push(undefined); // insertInto

		await submitReview({ bookingId: "booking-1", userId: "owner-1", rating: 3 });

		expect(executeTakeFirstQueue).toHaveLength(0);
		expect(executeQueue).toHaveLength(0);
	});

	it("submits review with comment", async () => {
		executeTakeFirstQueue.push(booking);
		executeQueue.push(undefined); // insertInto

		await submitReview({
			bookingId: "booking-1",
			userId: "renter-1",
			rating: 4,
			comment: "Hyvä vuokrakokemus!",
		});

		expect(executeTakeFirstQueue).toHaveLength(0);
		expect(executeQueue).toHaveLength(0);
	});

	it("trims comment whitespace", async () => {
		executeTakeFirstQueue.push(booking);
		executeQueue.push(undefined); // insertInto

		await submitReview({
			bookingId: "booking-1",
			userId: "renter-1",
			rating: 3,
			comment: "   ok   ",
		});

		expect(executeTakeFirstQueue).toHaveLength(0);
		expect(executeQueue).toHaveLength(0);
	});
});

// --- computeReviewSummary ---

describe("computeReviewSummary", () => {
	it("returns null average for empty reviews array", () => {
		expect(computeReviewSummary([])).toEqual({ averageRating: null, reviewCount: 0 });
	});

	it("computes average for single review", () => {
		expect(
			computeReviewSummary([
				{
					id: "r-1",
					rating: 4,
					comment: null,
					created_at: new Date(),
					reviewer_display_name: "Testaaja",
				},
			]),
		).toEqual({ averageRating: 4, reviewCount: 1 });
	});

	it("computes average for multiple reviews", () => {
		const reviews = [
			{ id: "r-1", rating: 4, comment: null, created_at: new Date(), reviewer_display_name: "A" },
			{ id: "r-2", rating: 5, comment: null, created_at: new Date(), reviewer_display_name: "B" },
		];
		expect(computeReviewSummary(reviews)).toEqual({ averageRating: 4.5, reviewCount: 2 });
	});

	it("rounds to one decimal", () => {
		const reviews = [
			{ id: "r-1", rating: 5, comment: null, created_at: new Date(), reviewer_display_name: "A" },
			{ id: "r-2", rating: 4, comment: null, created_at: new Date(), reviewer_display_name: "B" },
			{ id: "r-3", rating: 4, comment: null, created_at: new Date(), reviewer_display_name: "C" },
		];
		// (5+4+4)/3 = 4.333... → 4.3
		expect(computeReviewSummary(reviews)).toEqual({ averageRating: 4.3, reviewCount: 3 });
	});
});

// --- getReviewStatusForBooking ---

describe("getReviewStatusForBooking", () => {
	it("returns neither reviewed when no reviews exist", async () => {
		executeQueue.push([]);

		const status = await getReviewStatusForBooking("booking-1", "user-1", "2026-04-30");

		expect(status).toEqual({
			userHasReviewed: false,
			windowOpen: true, // Apr 30 + 14 = May 14, today is May 6
		});
	});

	it("returns user reviewed but counterparty has not", async () => {
		executeQueue.push([{ reviewer_id: "user-1" }]);

		const status = await getReviewStatusForBooking("booking-1", "user-1", "2026-05-05");

		expect(status).toEqual({
			userHasReviewed: true,
			windowOpen: true, // 1 day since end_date
		});
	});

	it("returns counterparty reviewed but user has not", async () => {
		executeQueue.push([{ reviewer_id: "other-user" }]);

		const status = await getReviewStatusForBooking("booking-1", "user-1", "2026-05-05");

		expect(status).toEqual({
			userHasReviewed: false,
			windowOpen: true,
		});
	});

	it("returns both reviewed", async () => {
		executeQueue.push([{ reviewer_id: "user-1" }, { reviewer_id: "other-user" }]);

		const status = await getReviewStatusForBooking("booking-1", "user-1", "2026-05-05");

		expect(status).toEqual({
			userHasReviewed: true,
			windowOpen: true,
		});
	});

	it("reports window as open at exactly deadline boundary", async () => {
		executeQueue.push([]);

		// end_date is today (May 6). Window still open (<= deadline, which is May 20).
		const status = await getReviewStatusForBooking("booking-1", "user-1", "2026-05-06");

		expect(status).toEqual({
			userHasReviewed: false,
			windowOpen: true,
		});
	});
});
