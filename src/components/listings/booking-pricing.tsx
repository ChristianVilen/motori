import type { BookingCost } from "~/lib/bookings";
import { FI_DOW_TICKET, FI_MONTH_SHORT } from "~/lib/calendar-helpers";
import { cn } from "~/lib/cn";
import { formatEur } from "~/lib/i18n";

interface BookingPricingProps {
	cost: BookingCost | null;
	maxStayError: boolean;
	heroImageUrl?: string | null;
	fromDate: Date | null;
	toDate: Date | null;
	from: string | null;
	to: string | null;
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	t: (key: string, opts?: Record<string, unknown>) => string;
}

export function BookingPricing(props: BookingPricingProps) {
	const { t } = props;

	return (
		<div className="flex flex-col gap-3.5">
			<PricingRates
				pricePerDayCents={props.pricePerDayCents}
				pricePerWeekCents={props.pricePerWeekCents}
				pricePerWeekendCents={props.pricePerWeekendCents}
				t={t}
			/>

			<CalendarHero
				cost={props.cost}
				maxStayError={props.maxStayError}
				heroImageUrl={props.heroImageUrl}
				fromDate={props.fromDate}
				toDate={props.toDate}
				t={t}
			/>

			<CalendarFooter cost={props.cost} from={props.from} to={props.to} t={t} />
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
				"flex items-center gap-3 rounded-xl border border-border px-5 py-4",
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
