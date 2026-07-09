import { describe, expect, it } from "vitest";
import { computeDueState, reanchorOnComplete } from "./due-state";

// Build `today` at LOCAL noon so the hand-computed day counts hold in every TZ
// (noon-UTC would roll to the next local calendar day at UTC+14 and skew diffs).
const T = (s: string) => {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y, m - 1, d, 12, 0, 0);
};

describe("computeDueState — interval reminders", () => {
	const base = {
		type: "interval" as const,
		interval_km: 5000,
		interval_months: null,
		last_done_at: "2026-01-01",
		last_done_km: 10000,
		due_date: null,
	};

	it("is ok when far from the km threshold", () => {
		const s = computeDueState(base, 12000, T("2026-02-01"));
		expect(s.status).toBe("ok");
		expect(s.dueInKm).toBe(3000);
	});

	it("is due_soon within 500 km", () => {
		expect(computeDueState(base, 14600, T("2026-02-01")).status).toBe("due_soon");
	});

	it("is overdue past the km threshold", () => {
		const s = computeDueState(base, 15100, T("2026-02-01"));
		expect(s.status).toBe("overdue");
		expect(s.dueInKm).toBe(-100);
	});

	it("uses months when only interval_months is set", () => {
		const r = { ...base, interval_km: null, interval_months: 12 };
		expect(computeDueState(r, 10000, T("2026-06-01")).status).toBe("ok");
		expect(computeDueState(r, 10000, T("2026-12-15")).status).toBe("due_soon");
		expect(computeDueState(r, 10000, T("2027-01-02")).status).toBe("overdue");
	});

	it("first hit wins when both km and months are set", () => {
		const r = { ...base, interval_months: 12 };
		// km overdue, months ok → overdue
		expect(computeDueState(r, 15100, T("2026-02-01")).status).toBe("overdue");
		// km ok, months due_soon → due_soon
		expect(computeDueState(r, 10100, T("2026-12-15")).status).toBe("due_soon");
	});

	it("treats a missing km anchor as months-only", () => {
		const r = { ...base, last_done_km: null, interval_months: 12 };
		expect(computeDueState(r, 99999, T("2026-02-01")).status).toBe("ok");
	});

	it("is due_soon when km is exactly at the 500 boundary", () => {
		// 10000 + 5000 - 14500 = 500
		const s = computeDueState(base, 14500, T("2026-02-01"));
		expect(s.dueInKm).toBe(500);
		expect(s.status).toBe("due_soon");
	});

	it("is due_soon (not overdue) when dueInKm is exactly 0", () => {
		// 10000 + 5000 - 15000 = 0 → due today, not yet past
		const s = computeDueState(base, 15000, T("2026-02-01"));
		expect(s.dueInKm).toBe(0);
		expect(s.status).toBe("due_soon");
	});

	it("is ok with both dueIn null when an interval reminder has no thresholds", () => {
		const r = { ...base, interval_km: null, interval_months: null };
		const s = computeDueState(r, 99999, T("2026-02-01"));
		expect(s.status).toBe("ok");
		expect(s.dueInKm).toBeNull();
		expect(s.dueInDays).toBeNull();
	});
});

describe("computeDueState — date reminders", () => {
	const vakuutus = {
		type: "date" as const,
		interval_km: null,
		interval_months: null,
		last_done_at: null,
		last_done_km: null,
		due_date: "2026-08-01",
	};

	it("is ok more than 30 days out", () => {
		const s = computeDueState(vakuutus, 0, T("2026-06-01"));
		expect(s.status).toBe("ok");
		expect(s.dueInDays).toBe(61);
	});

	it("is due_soon within 30 days", () => {
		expect(computeDueState(vakuutus, 0, T("2026-07-15")).status).toBe("due_soon");
	});

	it("is overdue past the date", () => {
		const s = computeDueState(vakuutus, 0, T("2026-08-02"));
		expect(s.status).toBe("overdue");
		expect(s.dueInDays).toBe(-1);
	});

	it("is due_soon when a date is exactly 30 days out", () => {
		// 2026-07-02 → 2026-08-01 is 30 calendar days
		const s = computeDueState(vakuutus, 0, T("2026-07-02"));
		expect(s.dueInDays).toBe(30);
		expect(s.status).toBe("due_soon");
	});

	it("is due_soon (not overdue) when a date reminder is due today", () => {
		const s = computeDueState(vakuutus, 0, T("2026-08-01"));
		expect(s.dueInDays).toBe(0);
		expect(s.status).toBe("due_soon");
	});

	it("is ok with null dueInDays when a date reminder has no due_date", () => {
		const s = computeDueState({ ...vakuutus, due_date: null }, 0, T("2026-08-01"));
		expect(s.status).toBe("ok");
		expect(s.dueInDays).toBeNull();
	});
});

describe("reanchorOnComplete", () => {
	it("re-anchors an interval reminder to the completion", () => {
		const u = reanchorOnComplete({ type: "interval", due_date: null }, "2026-07-08", 15200);
		expect(u).toEqual({ last_done_at: "2026-07-08", last_done_km: 15200, notified_at: null });
	});

	it("keeps last_done_km null when no odometer was given", () => {
		const u = reanchorOnComplete({ type: "interval", due_date: null }, "2026-07-08", null);
		expect(u).toEqual({ last_done_at: "2026-07-08", last_done_km: null, notified_at: null });
	});

	it("rolls a date reminder forward one year from its due date", () => {
		const u = reanchorOnComplete({ type: "date", due_date: "2026-08-01" }, "2026-07-20", null);
		expect(u).toEqual({ due_date: "2027-08-01", notified_at: null });
	});

	it("rolls forward from the completion date when due_date is missing", () => {
		const u = reanchorOnComplete({ type: "date", due_date: null }, "2026-07-20", null);
		expect(u).toEqual({ due_date: "2027-07-20", notified_at: null });
	});
});
