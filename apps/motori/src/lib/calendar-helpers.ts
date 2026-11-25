export const MAX_STAY = 30;
export const DAYS_AHEAD = 150;

export function toIso(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function fromIso(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function diffDays(a: string, b: string): number {
	return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

export function addDaysToIso(iso: string, n: number): string {
	const d = fromIso(iso);
	d.setDate(d.getDate() + n);
	return toIso(d);
}

export interface Availability {
	availability_default: "open" | "closed";
	exception_dates: string[];
	booked_dates: string[];
}

export function blockedDays(availability: Availability) {
	const booked = new Set(availability.booked_dates);
	const exceptions = new Set(availability.exception_dates);
	return (iso: string) =>
		booked.has(iso) ||
		(availability.availability_default === "open" ? exceptions.has(iso) : !exceptions.has(iso));
}

export type RangeResult =
	| { from: string; to: string; clamped: boolean }
	| { from: string; to: null; clamped: false; reason: "blocked" };

export function computeNewRange(
	iso: string,
	existingFrom: string,
	isBlocked: (day: string) => boolean = () => false,
): RangeResult {
	const from = iso < existingFrom ? iso : existingFrom;
	const end = iso < existingFrom ? existingFrom : iso;
	for (let date = from; date <= end; date = addDaysToIso(date, 1)) {
		if (isBlocked(date)) {
			return { from: iso, to: null, clamped: false, reason: "blocked" };
		}
	}
	const clamped = diffDays(from, end) + 1 > MAX_STAY;
	return { from, to: clamped ? addDaysToIso(from, MAX_STAY - 1) : end, clamped };
}

export interface RentalSearch {
	from?: string;
	to?: string;
	step?: "request";
}

export function availableSelection(
	search: RentalSearch,
	today: string,
	isBlocked: (date: string) => boolean,
): RentalSearch {
	const { from, to } = search;
	const last = addDaysToIso(today, DAYS_AHEAD - 1);
	if (!from || from < today || from > last || isBlocked(from)) {
		return {};
	}
	if (!to || to < from || to > last || diffDays(from, to) >= MAX_STAY) {
		return { from };
	}
	if (computeNewRange(to, from, isBlocked).to === null) {
		return { from };
	}
	return { from, to, step: search.step };
}
