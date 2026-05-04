import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { cn } from "~/lib/cn";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_STAY = 30;
export const DAYS_AHEAD = 150;

export const FI_MONTH_SHORT = [
	"tam",
	"hel",
	"maa",
	"huh",
	"tou",
	"kes",
	"hei",
	"elo",
	"syy",
	"lok",
	"mar",
	"jou",
] as const;

export const FI_DOW_TICKET = ["su", "ma", "ti", "ke", "to", "pe", "la"] as const;

// ── ISO date helpers ──────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayInfo {
	iso: string;
	dayNum: number;
	ariaLabel: string;
}

export interface MonthGroup {
	key: string;
	label: string;
	weeks: (DayInfo | null)[][];
}

// ── Month builder ─────────────────────────────────────────────────────────────

export function buildMonths(todayIso: string): MonthGroup[] {
	const base = fromIso(todayIso);
	const groups: MonthGroup[] = [];

	interface InProgress {
		key: string;
		label: string;
		cells: (DayInfo | null)[];
	}
	let current: InProgress | null = null;

	function flush(c: InProgress): MonthGroup {
		const cells = [...c.cells];
		while (cells.length % 7 !== 0) {
			cells.push(null);
		}
		const weeks: (DayInfo | null)[][] = [];
		for (let i = 0; i < cells.length; i += 7) {
			weeks.push(cells.slice(i, i + 7));
		}
		return { key: c.key, label: c.label, weeks };
	}

	for (let i = 0; i < DAYS_AHEAD; i++) {
		const d = new Date(base);
		d.setDate(base.getDate() + i);
		const iso = toIso(d);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

		if (!current || current.key !== key) {
			if (current) {
				groups.push(flush(current));
			}
			const dow = (d.getDay() + 6) % 7;
			const cells: (DayInfo | null)[] = Array<null>(dow).fill(null);
			current = { key, label: format(d, "LLLL yyyy", { locale: fi }), cells };
		}
		current.cells.push({
			iso,
			dayNum: d.getDate(),
			ariaLabel: format(d, "EEEE d. MMMM yyyy", { locale: fi }),
		});
	}
	if (current) {
		groups.push(flush(current));
	}
	return groups;
}

// ── Range helpers ─────────────────────────────────────────────────────────────

export interface RangeResult {
	from: string;
	to: string;
	clamped: boolean;
}

export function computeNewRange(iso: string, existingFrom: string): RangeResult | null {
	const a = iso < existingFrom ? iso : existingFrom;
	const b = iso < existingFrom ? existingFrom : iso;
	if (a === b) {
		return null;
	}
	if (diffDays(a, b) > MAX_STAY) {
		return { from: a, to: addDaysToIso(a, MAX_STAY), clamped: true };
	}
	return { from: a, to: b, clamped: false };
}

export function getKeyboardOffset(key: string, d: Date): number | null {
	if (key === "ArrowRight") {
		return 1;
	}
	if (key === "ArrowLeft") {
		return -1;
	}
	if (key === "ArrowDown") {
		return 7;
	}
	if (key === "ArrowUp") {
		return -7;
	}
	if (key === "Home") {
		const dow = d.getDay();
		const dist = dow === 0 ? 6 : dow - 1;
		return dist === 0 ? 0 : -dist;
	}
	if (key === "End") {
		const dow = d.getDay();
		return dow === 0 ? 0 : 7 - dow;
	}
	return null;
}

// ── Day cell styling ──────────────────────────────────────────────────────────

export function getHighlightPosition(
	iso: string,
	from: string | null,
	to: string | null,
	inRange: boolean,
	inHover: boolean,
): string | null {
	if (iso === from && iso === to) {
		return null;
	}
	if (iso === from) {
		return "left-1/2 right-0 inset-y-1";
	}
	if (iso === to) {
		return "left-0 right-1/2 inset-y-1";
	}
	if (inRange || inHover) {
		return "inset-y-1 inset-x-0";
	}
	return null;
}

export function getDayButtonClass(
	isSelected: boolean,
	blocked: boolean,
	inRange: boolean,
	isToday: boolean,
): string {
	return cn(
		"relative z-10 flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors",
		"focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
		isSelected && "bg-accent font-semibold text-white",
		!isSelected && blocked && "cursor-not-allowed text-muted line-through opacity-40",
		!isSelected && !blocked && inRange && "font-medium text-foreground hover:bg-accent/10",
		!isSelected && !blocked && !inRange && "text-foreground hover:bg-muted-light",
		isToday &&
			!isSelected &&
			"font-bold underline decoration-accent decoration-2 underline-offset-2",
	);
}
