import { addMonths, addYears, differenceInCalendarDays, format } from "date-fns";
import { DUE_SOON_DAYS, DUE_SOON_KM } from "~/lib/constants";
import type { ReminderType } from "~/lib/db/schema";

export type DueStatus = "ok" | "due_soon" | "overdue";

export interface DueState {
	status: DueStatus;
	/** km until due (negative = past due); null when no km threshold applies */
	dueInKm: number | null;
	/** days until due (negative = past due); null when no date threshold applies */
	dueInDays: number | null;
}

export interface DueInput {
	type: ReminderType;
	interval_km: number | null;
	interval_months: number | null;
	last_done_at: string | null;
	last_done_km: number | null;
	due_date: string | null;
}

/** Parse a YYYY-MM-DD string as a local calendar date (TZ-stable). */
export function parseLocalDate(dateStr: string): Date {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y, m - 1, d);
}

/**
 * The next YYYY-MM-DD occurrence of any annual MM-DD anchor relative to `ref`.
 * `inclusive` decides whether an anchor falling exactly on `ref` counts (create)
 * or must be skipped to advance (mark-paid). TZ-stable — builds Dates in local
 * time like parseLocalDate. Requires at least one anchor.
 */
export function nextRecurrence(
	anchors: string[],
	ref: string,
	opts: { inclusive: boolean },
): string {
	if (anchors.length === 0) {
		throw new Error("nextRecurrence requires at least one anchor");
	}
	const refDate = parseLocalDate(ref);
	const refYear = refDate.getFullYear();
	let best: Date | null = null;
	// refYear+1 always yields a candidate strictly after any date in refYear,
	// so `best` is guaranteed set.
	for (const year of [refYear, refYear + 1]) {
		for (const anchor of anchors) {
			const [m, d] = anchor.split("-").map(Number);
			const candidate = new Date(year, m - 1, d);
			const passes = opts.inclusive ? candidate >= refDate : candidate > refDate;
			if (passes && (best === null || candidate < best)) {
				best = candidate;
			}
		}
	}
	return format(best as Date, "yyyy-MM-dd");
}

function kmRemaining(reminder: DueInput, vehicleOdometerKm: number): number | null {
	if (
		reminder.type !== "interval" ||
		reminder.interval_km === null ||
		reminder.last_done_km === null
	) {
		return null;
	}
	return reminder.last_done_km + reminder.interval_km - vehicleOdometerKm;
}

function daysRemaining(reminder: DueInput, today: Date): number | null {
	if (reminder.type === "date") {
		return reminder.due_date === null
			? null
			: differenceInCalendarDays(parseLocalDate(reminder.due_date), today);
	}
	if (reminder.interval_months === null || reminder.last_done_at === null) {
		return null;
	}
	const dueDate = addMonths(parseLocalDate(reminder.last_done_at), reminder.interval_months);
	return differenceInCalendarDays(dueDate, today);
}

/**
 * Read-time due evaluation — no background state. `due_soon` = within 500 km
 * or 30 days. For interval reminders with both thresholds, first hit wins.
 */
export function computeDueState(
	reminder: DueInput,
	vehicleOdometerKm: number,
	today: Date = new Date(),
): DueState {
	const dueInKm = kmRemaining(reminder, vehicleOdometerKm);
	const dueInDays = daysRemaining(reminder, today);

	const overdue = (dueInKm !== null && dueInKm < 0) || (dueInDays !== null && dueInDays < 0);
	const dueSoon =
		(dueInKm !== null && dueInKm <= DUE_SOON_KM) ||
		(dueInDays !== null && dueInDays <= DUE_SOON_DAYS);

	return { status: overdue ? "overdue" : dueSoon ? "due_soon" : "ok", dueInKm, dueInDays };
}

/**
 * What completing a reminder writes back: interval reminders re-anchor to the
 * completion; payment reminders (recurrence_dates set) advance to the next
 * anchor; other date reminders roll due_date forward a year. Either way the
 * notified_at dedupe stamp clears so the next due cycle emails again.
 */
export function reanchorOnComplete(
	reminder: { type: ReminderType; due_date: string | null; recurrence_dates: string[] | null },
	performedAt: string,
	odometerKm: number | null,
):
	| { last_done_at: string; last_done_km: number | null; notified_at: null }
	| { due_date: string; notified_at: null } {
	if (reminder.type === "interval") {
		return { last_done_at: performedAt, last_done_km: odometerKm, notified_at: null };
	}
	const from = reminder.due_date ?? performedAt;
	if (reminder.recurrence_dates && reminder.recurrence_dates.length > 0) {
		return {
			due_date: nextRecurrence(reminder.recurrence_dates, from, { inclusive: false }),
			notified_at: null,
		};
	}
	return { due_date: format(addYears(parseLocalDate(from), 1), "yyyy-MM-dd"), notified_at: null };
}
