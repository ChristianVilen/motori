import { cn } from "@motori/ui/cn";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	addDaysToIso,
	buildMonths,
	computeNewRange,
	type DayInfo,
	fromIso,
	getDayButtonClass,
	getHighlightPosition,
	getKeyboardOffset,
	type MonthGroup,
	toIso,
} from "~/lib/calendar-helpers";
import { useTranslation } from "~/lib/i18n";

const WEEK_HEADER = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BookingCalendarProps {
	bookedDates: string[];
	exceptionDates: string[];
	availabilityDefault: "open" | "closed";
	selectedRange: { from: string; to: string } | null;
	/** Called with (range | null, wasClamped). wasClamped is true when > MAX_STAY forced truncation. */
	onSelectRange: (range: { from: string; to: string } | null, wasClamped?: boolean) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingCalendar(props: BookingCalendarProps) {
	const { t } = useTranslation("listings");
	const liveRef = useRef<HTMLDivElement>(null);

	const todayIso = useMemo(() => toIso(new Date()), []);
	const months = useMemo(() => buildMonths(todayIso), [todayIso]);

	const [from, setFrom] = useState<string | null>(props.selectedRange?.from ?? null);
	const [to, setTo] = useState<string | null>(props.selectedRange?.to ?? null);
	const [hoverDate, setHoverDate] = useState<string | null>(null);
	const [focusedDate, setFocusedDate] = useState<string | null>(null);

	const bookedSet = useMemo(() => new Set(props.bookedDates), [props.bookedDates]);
	const exceptionSet = useMemo(() => new Set(props.exceptionDates), [props.exceptionDates]);

	const isBlocked = useCallback(
		(iso: string) => {
			if (bookedSet.has(iso)) {
				return true;
			}
			const inException = exceptionSet.has(iso);
			return props.availabilityDefault === "open" ? inException : !inException;
		},
		[bookedSet, exceptionSet, props.availabilityDefault],
	);

	const announce = useCallback((msg: string) => {
		if (liveRef.current) {
			liveRef.current.textContent = msg;
		}
	}, []);

	const handleDayClick = useCallback(
		(iso: string) => {
			if (isBlocked(iso)) {
				return;
			}
			if (!from || to) {
				setFrom(iso);
				setTo(null);
				props.onSelectRange(null);
				announce(t("booking.calendar.a11yPickup", { date: iso }));
				return;
			}
			const result = computeNewRange(iso, from);
			if (!result) {
				setFrom(null);
				setTo(null);
				props.onSelectRange(null);
				return;
			}
			setFrom(result.from);
			setTo(result.to);
			props.onSelectRange({ from: result.from, to: result.to }, result.clamped);
			announce(t("booking.calendar.a11yRange", { from: result.from, to: result.to }));
		},
		[from, to, isBlocked, props.onSelectRange, t, announce],
	);

	const handleGridKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				setFrom(null);
				setTo(null);
				props.onSelectRange(null);
				return;
			}
			const offset = getKeyboardOffset(e.key, fromIso(focusedDate ?? todayIso));
			if (offset === null) {
				return;
			}
			e.preventDefault();
			const nextIso = addDaysToIso(focusedDate ?? todayIso, offset);
			if (nextIso >= todayIso) {
				setFocusedDate(nextIso);
				document.querySelector<HTMLButtonElement>(`[data-date="${nextIso}"]`)?.focus();
			}
		},
		[focusedDate, todayIso, props.onSelectRange],
	);

	const handleDayMouseLeave = useCallback(() => setHoverDate(null), []);
	const handleDayFocus = useCallback((iso: string) => setFocusedDate(iso), []);
	const handleDayMouseEnter = useCallback((iso: string) => setHoverDate(iso), []);

	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card">
			<div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
			<div className="max-h-[460px] overflow-y-auto px-4 py-2 [scrollbar-width:thin]">
				{months.map((month) => (
					<MonthSection
						key={month.key}
						month={month}
						todayIso={todayIso}
						from={from}
						to={to}
						hoverDate={hoverDate}
						focusedDate={focusedDate}
						isBlocked={isBlocked}
						onDayClick={handleDayClick}
						onDayKeyDown={handleGridKeyDown}
						onDayMouseEnter={handleDayMouseEnter}
						onDayMouseLeave={handleDayMouseLeave}
						onDayFocus={handleDayFocus}
					/>
				))}
			</div>
		</div>
	);
}

// ── MonthSection ──────────────────────────────────────────────────────────────

interface MonthSectionProps {
	month: MonthGroup;
	todayIso: string;
	from: string | null;
	to: string | null;
	hoverDate: string | null;
	focusedDate: string | null;
	isBlocked: (iso: string) => boolean;
	onDayClick: (iso: string) => void;
	onDayKeyDown: (e: React.KeyboardEvent) => void;
	onDayMouseEnter: (iso: string) => void;
	onDayMouseLeave: () => void;
	onDayFocus: (iso: string) => void;
}

function MonthSection({
	month,
	todayIso,
	from,
	to,
	hoverDate,
	focusedDate,
	isBlocked,
	onDayClick,
	onDayKeyDown,
	onDayMouseEnter,
	onDayMouseLeave,
	onDayFocus,
}: MonthSectionProps) {
	return (
		<div className="mb-4">
			<div className="sticky top-0 z-10 bg-card pb-1 pt-3">
				<div className="mb-2 text-sm font-semibold capitalize text-foreground">{month.label}</div>
				<div className="grid grid-cols-7 text-center">
					{WEEK_HEADER.map((d) => (
						<div key={d} aria-hidden="true" className="py-1 text-[11px] font-medium text-muted">
							{d}
						</div>
					))}
				</div>
			</div>
			{/* biome-ignore lint/a11y/useSemanticElements: role="grid" pattern for date picker; table layout conflicts with CSS sticky headers */}
			<div role="grid" aria-label={month.label}>
				{month.weeks.map((week, wi) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: stable week position within month
					// biome-ignore lint/a11y/useSemanticElements: role="row" required by ARIA grid pattern; see outer comment
					// biome-ignore lint/a11y/useFocusableInteractive: row is not focusable; focus managed by child button via roving tabindex
					<div key={wi} role="row" className="grid grid-cols-7">
						{week.map((day, di) =>
							day ? (
								<DayCell
									key={day.iso}
									day={day}
									todayIso={todayIso}
									from={from}
									to={to}
									hoverDate={hoverDate}
									focusedDate={focusedDate}
									isBlocked={isBlocked}
									onDayClick={onDayClick}
									onDayKeyDown={onDayKeyDown}
									onDayMouseEnter={onDayMouseEnter}
									onDayMouseLeave={onDayMouseLeave}
									onDayFocus={onDayFocus}
								/>
							) : (
								// biome-ignore lint/suspicious/noArrayIndexKey: blank cell position within week row
								// biome-ignore lint/a11y/useSemanticElements: role="gridcell" required by ARIA grid; no semantic alternative for blank padding
								// biome-ignore lint/a11y/useFocusableInteractive: blank cell is intentionally non-interactive (aria-hidden)
								<div key={`blank-${wi}-${di}`} role="gridcell" aria-hidden="true" />
							),
						)}
					</div>
				))}
			</div>
		</div>
	);
}

// ── DayCell ───────────────────────────────────────────────────────────────────

interface DayCellProps {
	day: DayInfo;
	todayIso: string;
	from: string | null;
	to: string | null;
	hoverDate: string | null;
	focusedDate: string | null;
	isBlocked: (iso: string) => boolean;
	onDayClick: (iso: string) => void;
	onDayKeyDown: (e: React.KeyboardEvent) => void;
	onDayMouseEnter: (iso: string) => void;
	onDayMouseLeave: () => void;
	onDayFocus: (iso: string) => void;
}

function DayCell({
	day,
	todayIso,
	from,
	to,
	hoverDate,
	focusedDate,
	isBlocked,
	onDayClick,
	onDayKeyDown,
	onDayMouseEnter,
	onDayMouseLeave,
	onDayFocus,
}: DayCellProps) {
	const { iso, dayNum, ariaLabel } = day;
	const blocked = isBlocked(iso);
	const isFrom = iso === from;
	const isTo = iso === to;
	const inRange = !!from && !!to && iso > from && iso < to;
	const inHover =
		!!from && !to && !!hoverDate && hoverDate > from && iso > from && iso <= hoverDate;
	const isSelected = isFrom || isTo;
	const isFocused = iso === (focusedDate ?? todayIso);

	const highlightPos = getHighlightPosition(iso, from, to, inRange, inHover);
	const btnClass = getDayButtonClass(isSelected, blocked, inRange, iso === todayIso);

	return (
		// biome-ignore lint/a11y/useSemanticElements: role="gridcell" required by ARIA grid pattern; no semantic alternative
		// biome-ignore lint/a11y/useFocusableInteractive: focus managed by child button via roving tabindex; gridcell itself need not be focusable
		<div role="gridcell" aria-selected={isSelected} className="relative p-0.5">
			{highlightPos ? (
				<div
					aria-hidden="true"
					className={cn(
						"absolute",
						highlightPos,
						inHover && !inRange ? "bg-muted-light" : "bg-accent/15",
					)}
				/>
			) : null}
			<button
				type="button"
				data-date={iso}
				aria-label={ariaLabel}
				aria-pressed={isSelected}
				aria-disabled={blocked}
				disabled={blocked}
				tabIndex={isFocused ? 0 : -1}
				onClick={() => onDayClick(iso)}
				onKeyDown={onDayKeyDown}
				onMouseEnter={() => onDayMouseEnter(iso)}
				onMouseLeave={onDayMouseLeave}
				onFocus={() => onDayFocus(iso)}
				className={btnClass}
			>
				{dayNum}
			</button>
		</div>
	);
}
