/** Pure booking helpers — safe for client and server bundles. */

export type BookingLine =
	| { kind: "weekend"; cents: number }
	| { kind: "week"; count: number; cents: number }
	| { kind: "day"; count: number; unitCents: number; cents: number };

export interface BookingCost {
	lines: BookingLine[];
	savingsCents: number;
	totalCents: number;
	days: number;
	label: "weekend" | "week" | null;
}

/** Expand inclusive YYYY-MM-DD range to an array of YYYY-MM-DD strings. */
export function expandDateRange(start: string, end: string): string[] {
	if (end < start) {
		throw new Error(`end (${end}) is before start (${start})`);
	}
	const result: string[] = [];
	const cursor = new Date(`${start}T00:00:00Z`);
	const stop = new Date(`${end}T00:00:00Z`);
	while (cursor <= stop) {
		result.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return result;
}

export function computeBookingCost(
	from: string,
	to: string,
	pricePerDayCents: number,
	pricePerWeekCents: number | null,
	pricePerWeekendCents: number | null,
): BookingCost {
	const start = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

	const lines: BookingLine[] = [];
	let label: BookingCost["label"] = null;
	let dayCount = days;
	if (days === 3 && start.getUTCDay() === 5 && pricePerWeekendCents != null) {
		label = "weekend";
		lines.push({ kind: "weekend", cents: pricePerWeekendCents });
		dayCount = 0;
	} else if (days >= 7 && pricePerWeekCents != null) {
		label = "week";
		const count = Math.floor(days / 7);
		lines.push({ kind: "week", count, cents: count * pricePerWeekCents });
		dayCount = days % 7;
	}
	if (dayCount > 0) {
		lines.push({
			kind: "day",
			count: dayCount,
			unitCents: pricePerDayCents,
			cents: dayCount * pricePerDayCents,
		});
	}
	const totalCents = lines.reduce((sum, line) => sum + line.cents, 0);
	return {
		days,
		label,
		lines,
		totalCents,
		savingsCents: Math.max(0, days * pricePerDayCents - totalCents),
	};
}
