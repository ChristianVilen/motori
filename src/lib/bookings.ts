/** Pure booking helpers — safe for client and server bundles. */

export interface BookingCost {
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

	// Fri=5, Sun=0 in UTC
	const startDay = start.getUTCDay();
	const endDay = end.getUTCDay();
	if (days === 3 && startDay === 5 && endDay === 0 && pricePerWeekendCents) {
		return { totalCents: pricePerWeekendCents, days, label: "weekend" };
	}

	if (days >= 7 && pricePerWeekCents) {
		const fullWeeks = Math.floor(days / 7);
		const remainingDays = days % 7;
		return {
			totalCents: fullWeeks * pricePerWeekCents + remainingDays * pricePerDayCents,
			days,
			label: "week",
		};
	}

	return { totalCents: days * pricePerDayCents, days, label: null };
}
