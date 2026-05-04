import { fi } from "date-fns/locale";
import { useMemo } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { fromIso, toIso } from "~/lib/calendar-helpers";
import { useTranslation } from "~/lib/i18n";

export interface AvailabilityCalendarProps {
	/** Confirmed-booking dates that are immutable. YYYY-MM-DD. */
	bookedDates: string[];
	/** Owner-set exception dates. YYYY-MM-DD. */
	exceptionDates: string[];
	/** Per-listing default. */
	availabilityDefault: "open" | "closed";
	mode: "select-range" | "toggle-exceptions" | "view-only";
	/** When mode === "select-range". */
	selectedRange?: { from: string; to: string } | null;
	onSelectRange?: (range: { from: string; to: string } | null) => void;
	/** When mode === "toggle-exceptions". */
	onToggleException?: (date: string) => void;
}

export function AvailabilityCalendar(props: AvailabilityCalendarProps) {
	const { t } = useTranslation("listings");
	const {
		bookedDates,
		exceptionDates,
		availabilityDefault,
		mode,
		selectedRange,
		onSelectRange,
		onToggleException,
	} = props;

	const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);
	const exceptionSet = useMemo(() => new Set(exceptionDates), [exceptionDates]);

	function isBlocked(date: Date): boolean {
		const iso = toIso(date);
		if (bookedSet.has(iso)) {
			return true;
		}
		// availability_default = "open"  ⇒ exception means "blocked"
		// availability_default = "closed" ⇒ exception means "open"
		const inException = exceptionSet.has(iso);
		return availabilityDefault === "open" ? inException : !inException;
	}

	const modifiers: Record<string, Matcher> = {
		blocked: (date: Date) => isBlocked(date),
		booked: (date: Date) => bookedSet.has(toIso(date)),
	};

	const modifiersClassNames: Record<string, string> = {
		blocked: "rdp-blocked",
		booked: "rdp-booked",
	};

	function handleRangeSelect(range: { from?: Date; to?: Date } | undefined) {
		if (!onSelectRange) {
			return;
		}
		if (!range?.from) {
			onSelectRange(null);
			return;
		}
		const to = range.to ?? range.from;
		onSelectRange({ from: toIso(range.from), to: toIso(to) });
	}

	function handleSingleSelect(date: Date | undefined) {
		if (!date || !onToggleException) {
			return;
		}
		// Owner cannot toggle confirmed-booking dates.
		if (bookedSet.has(toIso(date))) {
			return;
		}
		onToggleException(toIso(date));
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (mode === "select-range") {
		return (
			<div>
				<DayPicker
					mode="range"
					locale={fi}
					selected={
						selectedRange
							? { from: fromIso(selectedRange.from), to: fromIso(selectedRange.to) }
							: undefined
					}
					onSelect={handleRangeSelect}
					disabled={[{ before: today }, (d: Date) => isBlocked(d)]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={2}
				/>
				<Legend
					availableLabel={t("booking.legend.available")}
					blockedLabel={t("booking.legend.blocked")}
					selectedLabel={t("booking.legend.selected")}
				/>
			</div>
		);
	}

	if (mode === "toggle-exceptions") {
		return (
			<div>
				<DayPicker
					mode="single"
					locale={fi}
					onSelect={handleSingleSelect}
					disabled={[{ before: today }, (d: Date) => bookedSet.has(toIso(d))]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={2}
				/>
				<Legend
					availableLabel={t("booking.legend.available")}
					blockedLabel={t("booking.legend.blocked")}
				/>
			</div>
		);
	}

	return (
		<div>
			<DayPicker
				mode="single"
				locale={fi}
				disabled
				modifiers={modifiers}
				modifiersClassNames={modifiersClassNames}
				numberOfMonths={2}
			/>
			<Legend
				availableLabel={t("booking.legend.available")}
				blockedLabel={t("booking.legend.blocked")}
			/>
		</div>
	);
}

function Legend(props: { availableLabel: string; blockedLabel: string; selectedLabel?: string }) {
	return (
		<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-3 w-3 rounded-sm bg-success/30" />
				{props.availableLabel}
			</span>
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-3 w-3 rounded-sm bg-destructive/30" />
				{props.blockedLabel}
			</span>
			{props.selectedLabel ? (
				<span className="flex items-center gap-1.5">
					<span className="inline-block h-3 w-3 rounded-sm bg-accent" />
					{props.selectedLabel}
				</span>
			) : null}
		</div>
	);
}
