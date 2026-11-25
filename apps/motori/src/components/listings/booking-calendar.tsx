import { enUS, fi } from "date-fns/locale";
import { useSyncExternalStore } from "react";
import { DayButton, type DayButtonProps, DayPicker } from "react-day-picker";
import {
	addDaysToIso,
	DAYS_AHEAD,
	fromIso,
	type RentalSearch,
	toIso,
} from "~/lib/calendar-helpers";
import { useTranslation } from "~/lib/i18n";

const desktopQuery = "(min-width: 900px)";
function subscribe(onChange: () => void) {
	const mq = window.matchMedia(desktopQuery);
	mq.addEventListener("change", onChange);
	return () => mq.removeEventListener("change", onChange);
}
export function useDesktopCalendar() {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(desktopQuery).matches,
		() => false,
	);
}

function DateButton(props: DayButtonProps) {
	return (
		<DayButton
			{...props}
			data-date={toIso(props.day.date)}
			aria-disabled={props.disabled || undefined}
		/>
	);
}

export function CalendarLegend({ selection = true }: { selection?: boolean }) {
	const { t } = useTranslation("listings");
	return (
		<ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
			{(selection ? ["available", "blocked", "selected"] : ["available", "blocked"]).map(
				(state) => (
					<li key={state} className="inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className={`size-3 rounded-full ${state === "selected" ? "bg-reflector" : state === "blocked" ? "calendar-unavailable" : "border border-border bg-card"}`}
						/>
						{t(`booking.legend.${state}`)}
					</li>
				),
			)}
		</ul>
	);
}

export function BookingCalendar({
	today,
	range,
	isBlocked,
	onDay,
	onClear,
}: {
	today: string;
	range: RentalSearch;
	isBlocked: (iso: string) => boolean;
	onDay: (iso: string) => void;
	onClear: () => void;
}) {
	const { t, i18n } = useTranslation("listings");
	const desktop = useDesktopCalendar();
	const last = addDaysToIso(today, DAYS_AHEAD - 1);
	const selected = range.from
		? { from: fromIso(range.from), to: range.to ? fromIso(range.to) : undefined }
		: undefined;
	return (
		<section
			id="rental-calendar"
			tabIndex={-1}
			className="scroll-mt-[calc(var(--header-height)+1rem)]"
		>
			<h2 className="mb-3 font-heading text-xl font-bold">{t("booking.calendarTitle")}</h2>
			<DayPicker
				mode="range"
				className="booking-calendar"
				components={{ DayButton: DateButton }}
				locale={i18n.language === "en" ? enUS : fi}
				weekStartsOn={1}
				today={fromIso(today)}
				defaultMonth={fromIso(range.from ?? today)}
				startMonth={fromIso(today)}
				endMonth={fromIso(last)}
				numberOfMonths={desktop ? 2 : 1}
				selected={selected}
				onSelect={(_range, day) => onDay(toIso(day))}
				disabled={[
					{ before: fromIso(today) },
					{ after: fromIso(last) },
					(day) => isBlocked(toIso(day)),
				]}
				modifiers={{ blocked: (day) => isBlocked(toIso(day)) }}
				modifiersClassNames={{ blocked: "rdp-blocked" }}
				labels={{
					labelNext: () => t("booking.nextMonth"),
					labelPrevious: () => t("booking.previousMonth"),
					labelNav: () => t("booking.calendarTitle"),
					labelDayButton: (day, mods) =>
						`${new Intl.DateTimeFormat(i18n.language, { weekday: "long", day: "numeric", month: "long" }).format(day)}, ${t(mods.blocked ? "booking.legend.blocked" : mods.disabled ? "booking.notSelectable" : "booking.legend.available").toLocaleLowerCase()}`,
				}}
				onDayKeyDown={(_day, _mods, e) => {
					if (e.key === "Escape") {
						onClear();
						e.preventDefault();
					}
				}}
			/>
			<CalendarLegend />
		</section>
	);
}
