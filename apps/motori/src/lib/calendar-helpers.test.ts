import { describe, expect, it } from "vitest";
import {
	addDaysToIso,
	computeNewRange,
	diffDays,
	fromIso,
	getDayButtonClass,
	getHighlightPosition,
	getKeyboardOffset,
	toIso,
} from "~/lib/calendar-helpers";

describe("toIso", () => {
	it("formats a date as YYYY-MM-DD", () => {
		expect(toIso(new Date("2026-05-04"))).toBe("2026-05-04");
	});

	it("zero-pads single-digit month and day", () => {
		expect(toIso(new Date("2026-01-01"))).toBe("2026-01-01");
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

	it("clamps to MAX_STAY (30 days)", () => {
		const result = computeNewRange("2026-06-15", "2026-05-01");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-31", clamped: true });
	});

	it("does not clamp when exactly at max stay", () => {
		// 2026-05-01 to 2026-05-31 = 30 days diff
		const result = computeNewRange("2026-05-31", "2026-05-01");
		expect(result).toEqual({ from: "2026-05-01", to: "2026-05-31", clamped: false });
	});
});

describe("getKeyboardOffset", () => {
	it("returns 1 for ArrowRight", () => {
		const d = new Date("2026-05-04");
		expect(getKeyboardOffset("ArrowRight", d)).toBe(1);
	});

	it("returns -1 for ArrowLeft", () => {
		const d = new Date("2026-05-04");
		expect(getKeyboardOffset("ArrowLeft", d)).toBe(-1);
	});

	it("returns 7 for ArrowDown", () => {
		const d = new Date("2026-05-04");
		expect(getKeyboardOffset("ArrowDown", d)).toBe(7);
	});

	it("returns -7 for ArrowUp", () => {
		const d = new Date("2026-05-04");
		expect(getKeyboardOffset("ArrowUp", d)).toBe(-7);
	});

	it("returns null for unrecognized key", () => {
		const d = new Date("2026-05-04");
		expect(getKeyboardOffset("Enter", d)).toBeNull();
	});

	it("Home on Monday returns 0", () => {
		// 2026-05-04 is Monday (day 1)
		expect(getKeyboardOffset("Home", new Date("2026-05-04"))).toBe(0);
	});

	it("Home on Wednesday returns -2", () => {
		// 2026-05-06 is Wednesday (day 3)
		expect(getKeyboardOffset("Home", new Date("2026-05-06"))).toBe(-2);
	});

	it("End on Monday returns 6", () => {
		expect(getKeyboardOffset("End", new Date("2026-05-04"))).toBe(6);
	});

	it("End on Sunday returns 0", () => {
		// 2026-05-10 is Sunday (day 0)
		expect(getKeyboardOffset("End", new Date("2026-05-10"))).toBe(0);
	});
});

describe("getHighlightPosition", () => {
	it("returns null for a single-day selection", () => {
		expect(getHighlightPosition("2026-05-04", "2026-05-04", "2026-05-04", false, false)).toBeNull();
	});

	it("returns left-half for the from date", () => {
		expect(getHighlightPosition("2026-05-01", "2026-05-01", "2026-05-05", false, false)).toBe(
			"left-1/2 right-0 inset-y-1",
		);
	});

	it("returns right-half for the to date", () => {
		expect(getHighlightPosition("2026-05-05", "2026-05-01", "2026-05-05", false, false)).toBe(
			"left-0 right-1/2 inset-y-1",
		);
	});

	it("returns full highlight for in-range day", () => {
		expect(getHighlightPosition("2026-05-03", "2026-05-01", "2026-05-05", true, false)).toBe(
			"inset-y-1 inset-x-0",
		);
	});

	it("returns full highlight for hover-range day", () => {
		expect(getHighlightPosition("2026-05-03", "2026-05-01", null, false, true)).toBe(
			"inset-y-1 inset-x-0",
		);
	});

	it("returns null for day outside range and hover", () => {
		expect(getHighlightPosition("2026-05-10", "2026-05-01", "2026-05-05", false, false)).toBeNull();
	});
});

describe("getDayButtonClass", () => {
	it("includes accent class when selected", () => {
		const cls = getDayButtonClass(true, false, false, false);
		expect(cls).toContain("bg-accent");
		expect(cls).toContain("text-white");
	});

	it("includes blocked class when blocked", () => {
		const cls = getDayButtonClass(false, true, false, false);
		expect(cls).toContain("cursor-not-allowed");
		expect(cls).toContain("line-through");
	});

	it("includes in-range class when in range", () => {
		const cls = getDayButtonClass(false, false, true, false);
		expect(cls).toContain("hover:bg-accent/10");
	});

	it("includes today class when today and not selected", () => {
		const cls = getDayButtonClass(false, false, false, true);
		expect(cls).toContain("underline");
	});

	it("does not include today underline when selected", () => {
		const cls = getDayButtonClass(true, false, false, true);
		expect(cls).not.toContain("underline");
	});
});
