import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isReviewEligible, isReviewRevealed, isReviewWindowOpen } from "./reviews";

describe("isReviewEligible", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-06T12:00:00Z"));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns true for confirmed booking with end_date in the past", () => {
		expect(isReviewEligible("confirmed", "2026-05-05")).toBe(true);
	});

	it("returns false for confirmed booking with end_date today", () => {
		expect(isReviewEligible("confirmed", "2026-05-06")).toBe(false);
	});

	it("returns false for confirmed booking with end_date in the future", () => {
		expect(isReviewEligible("confirmed", "2026-05-10")).toBe(false);
	});

	it("returns false for pending booking", () => {
		expect(isReviewEligible("pending", "2026-05-01")).toBe(false);
	});

	it("returns false for cancelled booking", () => {
		expect(isReviewEligible("cancelled", "2026-05-01")).toBe(false);
	});

	it("returns false for rejected booking", () => {
		expect(isReviewEligible("rejected", "2026-05-01")).toBe(false);
	});
});

describe("isReviewWindowOpen", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns true on the day after end_date", () => {
		vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
		expect(isReviewWindowOpen("2026-05-01")).toBe(true);
	});

	it("returns true at the deadline boundary (midnight of day 14)", () => {
		vi.setSystemTime(new Date("2026-05-15T00:00:00Z"));
		expect(isReviewWindowOpen("2026-05-01")).toBe(true);
	});

	it("returns false after 14 days have passed", () => {
		vi.setSystemTime(new Date("2026-05-15T00:00:01Z"));
		expect(isReviewWindowOpen("2026-05-01")).toBe(false);
	});
});

describe("isReviewRevealed", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns true when both submitted regardless of time", () => {
		vi.setSystemTime(new Date("2026-05-02T00:00:00Z"));
		expect(isReviewRevealed(true, "2026-05-01")).toBe(true);
	});

	it("returns false when only one submitted and within window", () => {
		vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));
		expect(isReviewRevealed(false, "2026-05-01")).toBe(false);
	});

	it("returns true when only one submitted but deadline passed", () => {
		vi.setSystemTime(new Date("2026-05-16T00:00:01Z"));
		expect(isReviewRevealed(false, "2026-05-01")).toBe(true);
	});

	it("returns false at exactly the deadline boundary", () => {
		vi.setSystemTime(new Date("2026-05-15T00:00:00Z"));
		expect(isReviewRevealed(false, "2026-05-01")).toBe(false);
	});
});
