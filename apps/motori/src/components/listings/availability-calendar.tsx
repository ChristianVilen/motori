import { enUS, fi } from "date-fns/locale";
import { useMemo } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { blockedDays, fromIso, toIso } from "~/lib/calendar-helpers";
import { useTranslation } from "~/lib/i18n";
import { CalendarLegend, useDesktopCalendar } from "./booking-calendar";

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
	const { i18n } = useTranslation("listings");
	const desktop = useDesktopCalendar();
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
	const blocked = useMemo(
		() =>
			blockedDays({
				availability_default: availabilityDefault,
				booked_dates: bookedDates,
				exception_dates: exceptionDates,
			}),
		[availabilityDefault, bookedDates, exceptionDates],
	);
	function isBlocked(date: Date) {
		return blocked(toIso(date));
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
					className="booking-calendar"
					weekStartsOn={1}
					locale={i18n.language === "en" ? enUS : fi}
					selected={
						selectedRange
							? { from: fromIso(selectedRange.from), to: fromIso(selectedRange.to) }
							: undefined
					}
					onSelect={handleRangeSelect}
					disabled={[{ before: today }, (d: Date) => isBlocked(d)]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={desktop ? 2 : 1}
				/>
				<CalendarLegend />
			</div>
		);
	}

	if (mode === "toggle-exceptions") {
		return (
			<div>
				<DayPicker
					mode="single"
					className="booking-calendar"
					weekStartsOn={1}
					locale={i18n.language === "en" ? enUS : fi}
					onSelect={handleSingleSelect}
					disabled={[{ before: today }, (d: Date) => bookedSet.has(toIso(d))]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={desktop ? 2 : 1}
				/>
				<CalendarLegend selection={false} />
			</div>
		);
	}

	return (
		<div>
			<DayPicker
				mode="single"
				className="booking-calendar"
				weekStartsOn={1}
				locale={i18n.language === "en" ? enUS : fi}
				disabled
				modifiers={modifiers}
				modifiersClassNames={modifiersClassNames}
				numberOfMonths={desktop ? 2 : 1}
			/>
			<CalendarLegend selection={false} />
		</div>
	);
}
