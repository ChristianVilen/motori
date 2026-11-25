import type { TFunction } from "i18next";
import type { BookingCost, BookingLine } from "~/lib/bookings";
import { fromIso, type RentalSearch } from "~/lib/calendar-helpers";
import { formatEur, useTranslation } from "~/lib/i18n";
import { BookingAmount } from "./booking-amount";

function label(line: BookingLine, t: TFunction, locale: string) {
	if (line.kind === "weekend") {
		return t("booking.rates.weekend");
	}
	if (line.kind === "week") {
		return t("booking.weeks", { count: line.count });
	}
	return t("booking.dayLine", { count: line.count, unit: formatEur(line.unitCents, locale) });
}

export function BookingPricing({ range, cost }: { range: RentalSearch; cost: BookingCost | null }) {
	const { t, i18n } = useTranslation("listings");
	const day = new Intl.DateTimeFormat(i18n.language, {
		weekday: "short",
		month: "numeric",
		day: "numeric",
	});
	return (
		<div data-testid="booking-summary" className="rounded-lg border border-border bg-card p-4">
			{!!range.from && (
				<dl className="mb-3 flex justify-between gap-3 text-sm">
					<div>
						<dt className="text-xs text-muted">{t("booking.calendar.pickup")}</dt>
						<dd className="font-semibold">{day.format(fromIso(range.from))}</dd>
					</div>
					<div className="text-right">
						<dt className="text-xs text-muted">{t("booking.calendar.return")}</dt>
						<dd className="font-semibold">{range.to ? day.format(fromIso(range.to)) : "—"}</dd>
					</div>
				</dl>
			)}
			{cost ? (
				<>
					<ul className="border-t border-border pt-2 text-sm">
						{cost.lines.map((line) => (
							<li key={line.kind} className="flex justify-between gap-2 py-1">
								<span>{label(line, t, i18n.language)}</span>
								<span className="tabular-nums">{formatEur(line.cents, i18n.language)}</span>
							</li>
						))}
					</ul>
					<p
						aria-live="polite"
						data-testid="booking-total"
						className="mt-2 flex items-baseline justify-between border-t border-border pt-3"
					>
						<span>{t("booking.total")}</span>
						<strong className="font-heading text-2xl font-extrabold tabular-nums">
							<BookingAmount cents={cost.totalCents} />
						</strong>
					</p>
					{cost.savingsCents > 0 && (
						<p
							data-booking-saving
							className="mt-2 inline-flex rounded-full bg-reflector px-2 py-1 text-xs font-semibold text-foreground"
						>
							{t("booking.saving", { amount: formatEur(cost.savingsCents, i18n.language) })}
						</p>
					)}
				</>
			) : (
				<p className="text-sm text-muted">
					{t(range.from ? "booking.calendar.selectReturnHint" : "booking.calendar.selectDatesHint")}
				</p>
			)}
		</div>
	);
}
