import { describe, expect, it } from "vitest";
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
