import { describe, expect, it } from "vitest";
import { addDaysToIso, computeNewRange, diffDays, fromIso, toIso } from "~/lib/calendar-helpers";

describe("toIso", () => {
	// Construct with local-time components: `new Date("2026-05-04")` would be UTC
	// midnight, which is the previous local day west of UTC.
	it("formats a date as YYYY-MM-DD", () => {
		expect(toIso(new Date(2026, 4, 4))).toBe("2026-05-04");
	});

	it("zero-pads single-digit month and day", () => {
		expect(toIso(new Date(2026, 0, 1))).toBe("2026-01-01");
	});
});

describe("fromIso", () => {
	it("parses an ISO string to local Date", () => {
		const d = fromIso("2026-05-04");
		expect(d.getFullYear()).toBe(2026);
		expect(d.getMonth()).toBe(4); // 0-indexed
		expect(d.getDate()).toBe(4);
	});
});

describe("diffDays", () => {
	it("returns 0 for same date", () => {
		expect(diffDays("2026-05-04", "2026-05-04")).toBe(0);
	});

	it("returns positive for later date", () => {
		expect(diffDays("2026-05-01", "2026-05-04")).toBe(3);
	});

	it("returns negative for earlier date", () => {
		expect(diffDays("2026-05-04", "2026-05-01")).toBe(-3);
	});
});

describe("addDaysToIso", () => {
	it("adds days forward", () => {
		expect(addDaysToIso("2026-05-01", 5)).toBe("2026-05-06");
	});

	it("crosses month boundary", () => {
		expect(addDaysToIso("2026-05-30", 3)).toBe("2026-06-02");
	});

	it("handles negative offset", () => {
		expect(addDaysToIso("2026-05-04", -3)).toBe("2026-05-01");
	});
});

describe("computeNewRange", () => {
	it("returns ordered from/to when clicking after existing from", () => {
		const result = computeNewRange("2026-05-10", "2026-05-01");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-10", clamped: false });
	});

	it("returns ordered from/to when clicking before existing from", () => {
		const result = computeNewRange("2026-05-01", "2026-05-10");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-10", clamped: false });
	});

	it("returns single-day range when clicking same date", () => {
		expect(computeNewRange("2026-05-01", "2026-05-01")).toEqual({
			from: "2026-05-01",
			to: "2026-05-01",
			clamped: false,
		});
	});

	it("starts again on the selected day when an unavailable day is inside the range", () => {
		expect(computeNewRange("2026-05-05", "2026-05-01", (iso) => iso === "2026-05-03")).toEqual({
			from: "2026-05-05",
			to: null,
			reason: "blocked",
			clamped: false,
		});
	});
	it("clamps to MAX_STAY (30 days)", () => {
		const result = computeNewRange("2026-06-15", "2026-05-01");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-30", clamped: true });
	});

	it("does not clamp when exactly at max stay", () => {
		// The pickup and return dates each count as one day.
		const result = computeNewRange("2026-05-30", "2026-05-01");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-30", clamped: false });
	});
});
