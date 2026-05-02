import { describe, expect, it } from "vitest";
import { computeBookingCost } from "~/components/listings/booking-request-form";
import { expandDateRange } from "./bookings";

describe("expandDateRange", () => {
	it("expands a single-day range to one date", () => {
		expect(expandDateRange("2026-05-01", "2026-05-01")).toEqual(["2026-05-01"]);
	});

	it("expands a multi-day range inclusive of both ends", () => {
		expect(expandDateRange("2026-05-01", "2026-05-04")).toEqual([
			"2026-05-01",
			"2026-05-02",
			"2026-05-03",
			"2026-05-04",
		]);
	});

	it("crosses month boundaries", () => {
		expect(expandDateRange("2026-04-30", "2026-05-02")).toEqual([
			"2026-04-30",
			"2026-05-01",
			"2026-05-02",
		]);
	});

	it("throws when end is before start", () => {
		expect(() => expandDateRange("2026-05-04", "2026-05-01")).toThrow();
	});
});

describe("computeBookingCost", () => {
	const DAY = 2500; // 25 €
	const WEEK = 15000; // 150 €
	const WEEKEND = 4000; // 40 €

	it("uses day rate for a plain 3-day range", () => {
		// 2026-05-04 (Mon) to 2026-05-06 (Wed)
		expect(computeBookingCost("2026-05-04", "2026-05-06", DAY, null, null)).toEqual({
			totalCents: 7500,
			days: 3,
			label: null,
		});
	});

	it("uses weekend rate for Fri–Sun when set", () => {
		// 2026-05-01 (Fri) to 2026-05-03 (Sun)
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, null, WEEKEND)).toEqual({
			totalCents: 4000,
			days: 3,
			label: "weekend",
		});
	});

	it("uses day rate for Fri–Sun when no weekend price set", () => {
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, null, null)).toEqual({
			totalCents: 7500,
			days: 3,
			label: null,
		});
	});

	it("uses week rate for 7-day range", () => {
		// 2026-05-04 (Mon) to 2026-05-10 (Sun) = 7 days
		expect(computeBookingCost("2026-05-04", "2026-05-10", DAY, WEEK, null)).toEqual({
			totalCents: 15000,
			days: 7,
			label: "week",
		});
	});

	it("uses week rate for 14-day range (2 full weeks)", () => {
		expect(computeBookingCost("2026-05-04", "2026-05-17", DAY, WEEK, null)).toEqual({
			totalCents: 30000,
			days: 14,
			label: "week",
		});
	});

	it("mixes week and day rates for 10-day range", () => {
		// 1 week (15000) + 3 days (7500) = 22500
		expect(computeBookingCost("2026-05-04", "2026-05-13", DAY, WEEK, null)).toEqual({
			totalCents: 22500,
			days: 10,
			label: "week",
		});
	});

	it("weekend rate takes priority over week rate for Fri–Sun", () => {
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, WEEK, WEEKEND)).toEqual({
			totalCents: 4000,
			days: 3,
			label: "weekend",
		});
	});
});
