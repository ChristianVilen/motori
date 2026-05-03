import { format } from "date-fns";
import { fi } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type BookingCost, computeBookingCost } from "~/lib/booking-cost";
import { cn } from "~/lib/cn";
import { formatEur, useTranslation } from "~/lib/i18n";

const MAX_STAY = 30;
const DAYS_AHEAD = 150;

const FI_MONTH_SHORT = [
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
const FI_DOW_TICKET = ["su", "ma", "ti", "ke", "to", "pe", "la"] as const;
const WEEK_HEADER = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"] as const;

// ── Date helpers ──────────────────────────────────────────────────────────────

function toIso(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function fromIso(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function diffDays(a: string, b: string): number {
	return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);
}

function addDaysToIso(iso: string, n: number): string {
	const d = fromIso(iso);
	d.setDate(d.getDate() + n);
	return toIso(d);
}

// ── Month builder (produces weeks for table layout) ───────────────────────────

interface DayInfo {
	iso: string;
	dayNum: number;
	ariaLabel: string;
}

interface MonthGroup {
	key: string;
	label: string;
	weeks: (DayInfo | null)[][];
}

function buildMonths(todayIso: string): MonthGroup[] {
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

// ── Range helpers (pure) ──────────────────────────────────────────────────────

interface RangeResult {
	from: string;
	to: string;
	clamped: boolean;
}

function computeNewRange(iso: string, existingFrom: string): RangeResult | null {
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

function getKeyboardOffset(key: string, d: Date): number | null {
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
		return -(dow === 0 ? 6 : dow - 1);
	}
	if (key === "End") {
		const dow = d.getDay();
		return dow === 0 ? 0 : 7 - dow;
	}
	return null;
}

// ── Day cell styling helpers ──────────────────────────────────────────────────

function getHighlightPosition(
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

function getDayButtonClass(
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

// ── Props ─────────────────────────────────────────────────────────────────────

export interface BookingCalendarProps {
	bookedDates: string[];
	exceptionDates: string[];
	availabilityDefault: "open" | "closed";
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	heroImageUrl?: string | null;
	selectedRange: { from: string; to: string } | null;
	onSelectRange: (range: { from: string; to: string } | null) => void;
	onClose?: () => void;
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
	const [maxStayError, setMaxStayError] = useState(false);
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

	const cost: BookingCost | null = useMemo(
		() =>
			from && to
				? computeBookingCost(
						from,
						to,
						props.pricePerDayCents,
						props.pricePerWeekCents,
						props.pricePerWeekendCents,
					)
				: null,
		[from, to, props.pricePerDayCents, props.pricePerWeekCents, props.pricePerWeekendCents],
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
				setMaxStayError(false);
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
			setMaxStayError(result.clamped);
			props.onSelectRange({ from: result.from, to: result.to });
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

	const fromDate = from ? fromIso(from) : null;
	const toDate = to ? fromIso(to) : null;

	return (
		<div className="flex flex-col gap-3.5">
			<div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />

			<PricingRates
				pricePerDayCents={props.pricePerDayCents}
				pricePerWeekCents={props.pricePerWeekCents}
				pricePerWeekendCents={props.pricePerWeekendCents}
				t={t}
			/>

			<CalendarHero
				cost={cost}
				maxStayError={maxStayError}
				heroImageUrl={props.heroImageUrl}
				fromDate={fromDate}
				toDate={toDate}
				t={t}
			/>

			<div className="overflow-hidden rounded-xl border border-border bg-card">
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

				<CalendarFooter cost={cost} from={from} to={to} t={t} />
			</div>
		</div>
	);
}

// ── CalendarHero ──────────────────────────────────────────────────────────────

interface HeroProps {
	cost: BookingCost | null;
	maxStayError: boolean;
	heroImageUrl?: string | null;
	fromDate: Date | null;
	toDate: Date | null;
	t: (key: string, opts?: Record<string, unknown>) => string;
}

function CalendarHero({ cost, maxStayError, heroImageUrl, fromDate, toDate, t }: HeroProps) {
	const fromMonthShort = fromDate ? FI_MONTH_SHORT[fromDate.getMonth()] : null;
	const toMonthShort = toDate ? FI_MONTH_SHORT[toDate.getMonth()] : null;
	const fromDow = fromDate ? FI_DOW_TICKET[fromDate.getDay()] : null;
	const toDow = toDate ? FI_DOW_TICKET[toDate.getDay()] : null;

	return (
		<div
			className="relative overflow-hidden rounded-2xl p-6 text-white"
			style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, #2d2540 100%)" }}
		>
			{heroImageUrl ? (
				<div
					aria-hidden="true"
					className="absolute inset-0"
					style={{
						backgroundImage: `url(${heroImageUrl})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
						opacity: 0.18,
					}}
				/>
			) : null}
			<div className="relative">
				<div className="mb-3 text-[11px] font-semibold uppercase tracking-widest opacity-70">
					{t("booking.calendar.tripLength")}
				</div>
				<div className="mb-5 flex items-baseline gap-2.5">
					<span className="text-[72px] font-extrabold leading-none tracking-tighter">
						{cost ? cost.days : 0}
					</span>
					<span className="text-xl font-medium opacity-80">
						{cost?.days === 1 ? t("booking.calendar.day") : t("booking.calendar.days")}
					</span>
					<RateBadge label={cost?.label ?? null} t={t} />
				</div>
				{maxStayError ? (
					<p className="mb-3 text-xs text-orange-300">{t("booking.calendar.maxStayError")}</p>
				) : null}
				<div className="grid grid-cols-[1fr_auto_1fr] items-center">
					<TicketCard
						label={t("booking.calendar.pickup")}
						dayNum={fromDate?.getDate() ?? null}
						monthShort={fromMonthShort}
						dow={fromDow}
					/>
					<div className="px-2.5 text-accent-light">
						<svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden="true">
							<path
								d="M1 7h18M14 2l5 5-5 5"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<TicketCard
						label={t("booking.calendar.return")}
						dayNum={toDate?.getDate() ?? null}
						monthShort={toMonthShort}
						dow={toDow}
					/>
				</div>
			</div>
		</div>
	);
}

// ── PricingRates ─────────────────────────────────────────────────────────────

interface PricingRatesProps {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	t: (key: string, opts?: Record<string, unknown>) => string;
}

function PricingRates({
	pricePerDayCents,
	pricePerWeekCents,
	pricePerWeekendCents,
	t,
}: PricingRatesProps) {
	return (
		<div className="flex items-baseline gap-2 text-foreground">
			<span className="text-2xl font-bold text-accent">{formatEur(pricePerDayCents)}</span>
			<span className="text-sm text-muted">{t("detail.pricing.perDay")}</span>
			{pricePerWeekCents ? (
				<span className="ml-1 text-xs text-muted">
					· {t("detail.pricing.perWeek", { price: formatEur(pricePerWeekCents) })}
				</span>
			) : null}
			{pricePerWeekendCents ? (
				<span className="text-xs text-muted">
					· {t("detail.pricing.perWeekend", { price: formatEur(pricePerWeekendCents) })}
				</span>
			) : null}
		</div>
	);
}

// ── RateBadge ────────────────────────────────────────────────────────────────

function RateBadge({ label, t }: { label: "week" | "weekend" | null; t: (key: string) => string }) {
	if (!label) {
		return null;
	}
	const text =
		label === "week" ? t("booking.calendar.weekBadge") : t("booking.calendar.weekendBadge");
	return (
		<span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
			{text}
		</span>
	);
}

// ── TicketCard ────────────────────────────────────────────────────────────────

interface TicketCardProps {
	label: string;
	dayNum: number | null;
	monthShort: string | null;
	dow: string | null;
}

function TicketCard({ label, dayNum, monthShort, dow }: TicketCardProps) {
	return (
		<div className="rounded-[10px] border border-white/12 bg-white/8 px-4 py-3.5">
			<div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-accent-light">
				{label}
			</div>
			{dayNum !== null ? (
				<>
					<div className="flex items-baseline gap-1.5">
						<span className="text-3xl font-extrabold tracking-tight">{dayNum}</span>
						<span className="text-sm font-medium opacity-70">{monthShort}</span>
					</div>
					<div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-50">
						{dow}
					</div>
				</>
			) : (
				<div className="text-sm opacity-50">—</div>
			)}
		</div>
	);
}

// ── CalendarFooter ────────────────────────────────────────────────────────────

interface FooterProps {
	cost: BookingCost | null;
	from: string | null;
	to: string | null;
	t: (key: string) => string;
}

function CalendarFooter({ cost, from, to, t }: FooterProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 border-t border-border px-5 py-4",
				cost ? "bg-primary text-white" : "bg-background text-muted",
			)}
		>
			{cost ? (
				<div className="flex flex-col gap-0.5">
					<span className="text-2xl font-bold tracking-tight">{formatEur(cost.totalCents)}</span>
					<span className="text-xs opacity-70">
						{cost.days} {cost.days === 1 ? t("booking.calendar.day") : t("booking.calendar.days")}
						{cost.label === "week" ? ` · ${t("booking.costLabelWeek")}` : ""}
						{cost.label === "weekend" ? ` · ${t("booking.costLabelWeekend")}` : ""}
					</span>
				</div>
			) : (
				<span className="text-sm">
					{from && !to
						? t("booking.calendar.selectReturnHint")
						: t("booking.calendar.selectDatesHint")}
				</span>
			)}
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

// ── MobileBookingModal ────────────────────────────────────────────────────────

export interface MobileBookingModalProps {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
}

export function MobileBookingModal({ open, onClose, children }: MobileBookingModalProps) {
	const { t } = useTranslation("listings");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			return;
		}
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
		}
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!mounted || !open) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label={t("booking.calendarTitle")}
			className="fixed inset-0 z-50 flex flex-col bg-background"
		>
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-foreground">{t("booking.calendarTitle")}</h2>
				<button
					type="button"
					onClick={onClose}
					className="rounded-lg p-1.5 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
					aria-label={t("detail.back")}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path
							d="M6 6l8 8M14 6l-8 8"
							stroke="currentColor"
							strokeWidth="1.5"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
		</div>,
		document.body,
	);
}
