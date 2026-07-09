import { describe, expect, it } from "vitest";
import { selectDigestReminders } from "./digest";

const T = (s: string) => new Date(`${s}T12:00:00`);

const row = (over: Record<string, unknown>) => ({
	id: "r1",
	user_id: "u1",
	email: "u1@example.com",
	email_reminders: true,
	vehicle_id: "v1",
	vehicle_label: "Honda CB500F",
	odometer_km: 10000,
	type: "date" as const,
	title: "Vakuutus",
	interval_km: null,
	interval_months: null,
	last_done_at: null,
	last_done_km: null,
	due_date: "2026-07-20",
	notified_at: null,
	...over,
});

describe("selectDigestReminders", () => {
	it("includes a due_soon reminder not yet notified", () => {
		const out = selectDigestReminders([row({})], T("2026-07-08"));
		expect(out).toHaveLength(1);
		expect(out[0].userId).toBe("u1");
		expect(out[0].reminders[0].state.status).toBe("due_soon");
	});

	it("excludes ok reminders", () => {
		expect(selectDigestReminders([row({ due_date: "2026-12-01" })], T("2026-07-08"))).toHaveLength(
			0,
		);
	});

	it("excludes already-notified reminders (dedupe per due cycle)", () => {
		expect(
			selectDigestReminders([row({ notified_at: new Date("2026-07-01") })], T("2026-07-08")),
		).toHaveLength(0);
	});

	it("excludes users who disabled email reminders", () => {
		expect(selectDigestReminders([row({ email_reminders: false })], T("2026-07-08"))).toHaveLength(
			0,
		);
	});

	it("groups multiple reminders into one digest per user", () => {
		const rows = [
			row({}),
			row({
				id: "r2",
				title: "Öljynvaihto",
				type: "interval",
				due_date: null,
				interval_km: 5000,
				last_done_km: 6000,
				odometer_km: 10800,
			}),
			row({ id: "r3", user_id: "u2", email: "u2@example.com" }),
		];
		const out = selectDigestReminders(rows, T("2026-07-08"));
		expect(out).toHaveLength(2);
		const u1 = out.find((d) => d.userId === "u1");
		expect(u1?.reminders).toHaveLength(2);
	});
});
