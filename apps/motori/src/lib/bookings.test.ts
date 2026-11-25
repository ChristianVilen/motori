import { describe, expect, it } from "vitest";
import { computeBookingCost, expandDateRange } from "./bookings";

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
	const day = 9500;
	const week = 55000;
	const weekend = 24000;
	it("charges a Friday to Sunday weekend and shows the saving", () => {
		expect(computeBookingCost("2026-12-04", "2026-12-06", day, week, weekend)).toEqual({
			totalCents: 24000,
			days: 3,
			label: "weekend",
			lines: [{ kind: "weekend", cents: 24000 }],
			savingsCents: 4500,
		});
	});
	it("splits nine days into a week and two days", () => {
		expect(computeBookingCost("2026-12-04", "2026-12-12", day, week, weekend)).toEqual({
			totalCents: 74000,
			days: 9,
			label: "week",
			lines: [
				{ kind: "week", count: 1, cents: 55000 },
				{ kind: "day", count: 2, unitCents: 9500, cents: 19000 },
			],
			savingsCents: 11500,
		});
	});
	it.each([
		["2026-12-04", "2026-12-12", null, weekend, 9, 85500],
		["2026-12-04", "2026-12-04", week, weekend, 1, 9500],
		["2026-12-05", "2026-12-07", week, weekend, 3, 28500],
		["2026-12-04", "2026-12-06", week, null, 3, 28500],
	] as const)(
		"uses the day rate for %s through %s",
		(from, to, weekly, special, days, totalCents) => {
			expect(computeBookingCost(from, to, day, weekly, special)).toEqual({
				days,
				totalCents,
				label: null,
				lines: [{ kind: "day", count: days, unitCents: 9500, cents: totalCents }],
				savingsCents: 0,
			});
		},
	);
	it("shows one line for two full weeks and never shows negative savings", () => {
		expect(computeBookingCost("2026-12-01", "2026-12-14", 1000, 9000, null)).toEqual({
			totalCents: 18000,
			days: 14,
			label: "week",
			lines: [{ kind: "week", count: 2, cents: 18000 }],
			savingsCents: 0,
		});
	});
});
