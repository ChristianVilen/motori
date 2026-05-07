import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Queue-based DB mock ---
// Kysely's fluent API (db.selectFrom("x").select(...).where(...).executeTakeFirst())
// is mocked via a Proxy that returns itself for all chained methods, then consumes
// from the appropriate queue when a terminal method is called. Tests push expected
// results onto queues IN THE ORDER the production code executes its queries.

const executeQueue: unknown[] = [];
const executeTakeFirstQueue: unknown[] = [];
const executeTakeFirstOrThrowQueue: unknown[] = [];

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
				if (prop === "executeTakeFirstOrThrow") {
					return () => executeTakeFirstOrThrowQueue.shift();
				}
				return () => chainable();
			},
		},
	);
}

// biome-ignore lint/suspicious/noExplicitAny: test mock
const mockTransaction = vi.fn((fn: (trx: any) => unknown) =>
	fn({ selectFrom: () => chainable(), updateTable: () => chainable() }),
);

vi.mock("~/lib/db/index", () => ({
	db: {
		selectFrom: () => chainable(),
		insertInto: () => chainable(),
		updateTable: () => chainable(),
		deleteFrom: () => chainable(),
		transaction: () => ({
			// biome-ignore lint/suspicious/noExplicitAny: test mock
			execute: (fn: (trx: any) => unknown) => mockTransaction(fn),
		}),
	},
}));

vi.mock("~/lib/log", () => ({
	log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("~/lib/log/events", () => ({
	EVENTS: {
		booking: {
			requested: "booking.requested",
			confirmed: "booking.confirmed",
			rejected: "booking.rejected",
			cancelled: "booking.cancelled",
			expired: "booking.expired",
			auto_rejected_overlap: "booking.auto_rejected_overlap",
		},
	},
}));

const mockSendBookingRequestEmail = vi.fn().mockResolvedValue(undefined);
const mockSendBookingConfirmedEmail = vi.fn().mockResolvedValue(undefined);
const mockSendBookingRejectedEmail = vi.fn().mockResolvedValue(undefined);
const mockSendBookingAutoRejectedEmail = vi.fn().mockResolvedValue(undefined);

vi.mock("~/lib/booking-emails", () => ({
	sendBookingRequestEmail: (...args: unknown[]) => mockSendBookingRequestEmail(...args),
	sendBookingConfirmedEmail: (...args: unknown[]) => mockSendBookingConfirmedEmail(...args),
	sendBookingRejectedEmail: (...args: unknown[]) => mockSendBookingRejectedEmail(...args),
	sendBookingAutoRejectedEmail: (...args: unknown[]) => mockSendBookingAutoRejectedEmail(...args),
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

import {
	cancelBooking,
	confirmBooking,
	createBookingRequest,
	expireStaleBookings,
	rejectBooking,
} from "./bookings.server";

beforeEach(() => {
	vi.clearAllMocks();
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
	executeTakeFirstOrThrowQueue.length = 0;
});

// --- Tests ---

describe("createBookingRequest", () => {
	const baseArgs = {
		listingId: "listing-1",
		startDate: "2026-06-01",
		endDate: "2026-06-03",
		message: "Haluaisin vuokrata",
		userId: "user-renter",
		userEmail: "renter@test.fi",
	};

	it("throws when listing not found", async () => {
		executeTakeFirstQueue.push(null);

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("booking.listing_unavailable");
	});

	it("throws when listing is not active", async () => {
		executeTakeFirstQueue.push({ id: "listing-1", status: "draft", owner_id: "owner-1" });

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("booking.listing_unavailable");
	});

	it("throws when user tries to book own listing", async () => {
		executeTakeFirstQueue.push({ id: "listing-1", status: "active", owner_id: "user-renter" });

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("booking.own_listing");
	});

	it("throws when renter profile is missing", async () => {
		executeTakeFirstQueue.push({ id: "listing-1", status: "active", owner_id: "owner-1" });
		executeTakeFirstQueue.push(null); // no profile

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("auth.profile_missing");
	});

	it("throws when dates collide with confirmed booking", async () => {
		executeTakeFirstQueue.push({ id: "listing-1", status: "active", owner_id: "owner-1" });
		executeTakeFirstQueue.push({
			display_name: "Renter",
			phone: null,
			show_phone: false,
			language: "fi",
		});
		executeQueue.push([{ id: "existing-booking" }]); // collisions

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("booking.dates_unavailable");
	});

	it("throws when dates are blocked by availability exception", async () => {
		executeTakeFirstQueue.push({ id: "listing-1", status: "active", owner_id: "owner-1" });
		executeTakeFirstQueue.push({
			display_name: "Renter",
			phone: null,
			show_phone: false,
			language: "fi",
		});
		executeQueue.push([]); // no confirmed collisions
		executeTakeFirstQueue.push({ availability_default: "open" }); // default open
		executeQueue.push([{ date: "2026-06-02" }]); // exception blocks Jun 2

		await expect(createBookingRequest(baseArgs)).rejects.toThrow("booking.dates_unavailable");
	});

	it("creates booking and sends email on success", async () => {
		executeTakeFirstQueue.push({
			id: "listing-1",
			title: "Honda CB500",
			status: "active",
			owner_id: "owner-1",
			owner_email: "owner@test.fi",
			owner_display_name: "Owner",
			owner_phone: "040123",
			owner_show_phone: true,
			owner_language: "fi",
		});
		executeTakeFirstQueue.push({
			display_name: "Renter",
			phone: "050999",
			show_phone: true,
			language: "fi",
		});
		executeQueue.push([]); // no collisions
		executeTakeFirstQueue.push({ availability_default: "open" }); // availability default
		executeQueue.push([]); // no exception dates
		executeTakeFirstOrThrowQueue.push({ id: "booking-1", short_id: "abc123XY" });

		const result = await createBookingRequest(baseArgs);

		expect(result).toEqual({ short_id: "abc123XY" });
		expect(mockSendBookingRequestEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				booking: expect.objectContaining({ listing_title: "Honda CB500" }),
				owner: expect.objectContaining({ email: "owner@test.fi" }),
				renter: expect.objectContaining({ email: "renter@test.fi" }),
			}),
		);
	});
});

describe("confirmBooking", () => {
	it("throws when booking not found", async () => {
		executeTakeFirstQueue.push(null);

		await expect(confirmBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.not_found",
		);
	});

	it("throws when user is not the owner", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "pending", owner_id: "other-owner" });

		await expect(confirmBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.forbidden",
		);
	});

	it("throws when booking is not pending", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "confirmed", owner_id: "owner-1" });

		await expect(confirmBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.not_pending",
		);
	});

	it("confirms booking, auto-rejects overlaps, and sends emails", async () => {
		executeTakeFirstQueue.push({
			id: "b-1",
			short_id: "conf1",
			status: "pending",
			listing_id: "l-1",
			start_date: "2026-06-01",
			end_date: "2026-06-03",
			listing_title: "Honda CB500",
			owner_id: "owner-1",
			renter_email: "renter@test.fi",
			renter_name: "Renter",
			renter_language: "fi",
			owner_email: "owner@test.fi",
			owner_name: "Owner",
			owner_phone: "040123",
			owner_show_phone: true,
			owner_language: "fi",
		});
		// update confirmed
		executeTakeFirstQueue.push({ numUpdatedRows: 1n });
		// overlapping bookings
		executeQueue.push([
			{
				id: "b-2",
				short_id: "over1",
				start_date: "2026-06-02",
				end_date: "2026-06-04",
				email: "other@test.fi",
				display_name: "Other",
				language: "fi",
			},
		]);
		// update overlaps to rejected
		executeQueue.push(undefined);

		const result = await confirmBooking({ bookingId: "b-1", userId: "owner-1" });

		expect(result).toEqual({ autoRejectedCount: 1 });
		expect(mockSendBookingConfirmedEmail).toHaveBeenCalledTimes(1);
		expect(mockSendBookingAutoRejectedEmail).toHaveBeenCalledTimes(1);
	});
});

describe("rejectBooking", () => {
	it("throws when booking not found", async () => {
		executeTakeFirstQueue.push(null);

		await expect(rejectBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.not_found",
		);
	});

	it("throws when user is not the owner", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "pending", owner_id: "other-owner" });

		await expect(rejectBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.forbidden",
		);
	});

	it("throws when booking is not pending", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "confirmed", owner_id: "owner-1" });

		await expect(rejectBooking({ bookingId: "b-1", userId: "owner-1" })).rejects.toThrow(
			"booking.not_pending",
		);
	});

	it("rejects booking and sends email", async () => {
		executeTakeFirstQueue.push({
			id: "b-1",
			short_id: "abc123",
			status: "pending",
			start_date: "2026-06-01",
			end_date: "2026-06-03",
			listing_title: "Honda CB500",
			owner_id: "owner-1",
			renter_email: "renter@test.fi",
			renter_name: "Renter",
			renter_language: "fi",
		});
		executeTakeFirstQueue.push({ numUpdatedRows: 1n }); // update

		await rejectBooking({ bookingId: "b-1", userId: "owner-1", reason: "Ei sovi" });

		expect(mockSendBookingRejectedEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				booking: expect.objectContaining({ short_id: "abc123" }),
				reason: "Ei sovi",
			}),
		);
	});
});

describe("cancelBooking", () => {
	it("throws when booking not found", async () => {
		executeTakeFirstQueue.push(null);

		await expect(cancelBooking({ bookingId: "b-1", userId: "renter-1" })).rejects.toThrow(
			"booking.not_found",
		);
	});

	it("throws when user is not the renter", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "pending", renter_user_id: "other-renter" });

		await expect(cancelBooking({ bookingId: "b-1", userId: "renter-1" })).rejects.toThrow(
			"booking.forbidden",
		);
	});

	it("throws when booking is not pending", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "confirmed", renter_user_id: "renter-1" });

		await expect(cancelBooking({ bookingId: "b-1", userId: "renter-1" })).rejects.toThrow(
			"booking.not_pending",
		);
	});

	it("cancels booking successfully", async () => {
		executeTakeFirstQueue.push({ id: "b-1", status: "pending", renter_user_id: "renter-1" });
		executeTakeFirstQueue.push({ numUpdatedRows: 1n }); // update

		await cancelBooking({ bookingId: "b-1", userId: "renter-1" });

		// No email sent for cancellation
		expect(mockSendBookingRequestEmail).not.toHaveBeenCalled();
	});
});

describe("expireStaleBookings", () => {
	it("returns 0 when no bookings to expire", async () => {
		executeQueue.push([]); // update returning []

		const count = await expireStaleBookings();

		expect(count).toBe(0);
		expect(mockSendBookingAutoRejectedEmail).not.toHaveBeenCalled();
	});

	it("expires bookings and sends emails", async () => {
		executeQueue.push([{ id: "b-1" }, { id: "b-2" }]); // update returning
		executeQueue.push([
			// select expired details
			{
				id: "b-1",
				short_id: "abc1",
				start_date: "2026-05-01",
				end_date: "2026-05-03",
				listing_title: "Honda",
				renter_email: "r1@test.fi",
				renter_name: "R1",
				renter_language: "fi",
			},
			{
				id: "b-2",
				short_id: "abc2",
				start_date: "2026-05-02",
				end_date: "2026-05-04",
				listing_title: "Yamaha",
				renter_email: "r2@test.fi",
				renter_name: "R2",
				renter_language: "en",
			},
		]);

		const count = await expireStaleBookings();

		expect(count).toBe(2);
		expect(mockSendBookingAutoRejectedEmail).toHaveBeenCalledTimes(2);
	});
});
