import { type RefObject, useLayoutEffect, useRef } from "react";
import type { BookingCost } from "~/lib/bookings";
import { diffDays, type RentalSearch } from "~/lib/calendar-helpers";
import { formatEur } from "~/lib/i18n";
import { animateMotion, motionAllowed, motionEase, reducedMotionQuery } from "~/lib/motion";

function sweepRange(section: Element, from: string, to: string) {
	const days = diffDays(from, to) + 1;
	const duration = Math.min(300, 140 + 20 * days);
	const cells = section.querySelectorAll<HTMLElement>(".rdp-day[data-day]");
	const active: HTMLElement[] = [];
	const at = (index: number) => duration * (1 - Math.sqrt(1 - index / days));
	for (const cell of cells) {
		const day = cell.dataset.day;
		if (!day || day < from || day > to) {
			continue;
		}
		const offset = diffDays(from, day);
		cell.style.setProperty("--sweep-delay", `${at(offset)}ms`);
		cell.style.setProperty("--sweep-time", `${at(offset + 1) - at(offset)}ms`);
		cell.classList.add("range-sweep");
		active.push(cell);
	}
	const clear = () => {
		for (const cell of active) {
			cell.classList.remove("range-sweep");
			cell.style.removeProperty("--sweep-delay");
			cell.style.removeProperty("--sweep-time");
		}
	};
	const timeout = window.setTimeout(clear, duration + 16);
	return () => {
		clearTimeout(timeout);
		clear();
	};
}

function rollAmount(section: Element, shown: { current: number }, start: number, cents: number) {
	const amounts = section.querySelectorAll<HTMLElement>("[data-rolling-amount]");
	const preference = window.matchMedia(reducedMotionQuery);
	const started = performance.now();
	let frame = 0;
	function render(value: number) {
		shown.current = value;
		const text = formatEur(value);
		for (const node of amounts) {
			node.textContent = text;
		}
	}
	function tick(now: number) {
		const progress = Math.min(1, (now - started) / 350);
		const unit = start % 100 === 0 && cents % 100 === 0 ? 100 : 1;
		render(unit * Math.round((start + (cents - start) * (1 - (1 - progress) ** 3)) / unit));
		if (progress < 1) {
			frame = requestAnimationFrame(tick);
		}
	}
	function finish() {
		cancelAnimationFrame(frame);
		render(cents);
	}
	if (start !== cents) {
		render(start);
		frame = requestAnimationFrame(tick);
	}
	preference.addEventListener("change", finish);
	return () => {
		cancelAnimationFrame(frame);
		preference.removeEventListener("change", finish);
	};
}

export function useBookingMotion(
	selection: RentalSearch,
	cost: BookingCost | null,
	dayPrice: number,
	panelRef: RefObject<HTMLDivElement | null>,
) {
	const pending = useRef<RentalSearch | null>(null);
	const shown = useRef(cost?.totalCents ?? dayPrice);
	const lastSaving = useRef(cost?.savingsCents ?? 0);
	const cents = cost?.totalCents;
	const saving = cost?.savingsCents ?? 0;
	const { from, to } = selection;
	useLayoutEffect(() => {
		const picked = pending.current;
		pending.current = null;
		const newSaving = saving > 0 && saving !== lastSaving.current;
		lastSaving.current = saving;
		if (cents === undefined) {
			return;
		}
		const start = shown.current;
		if (!from || !to || picked?.from !== from || picked.to !== to || !motionAllowed()) {
			shown.current = cents;
			return;
		}
		const section = panelRef.current;
		if (!section) {
			return;
		}
		const clearSweep = sweepRange(section, from, to);
		const tag = section.querySelector("[data-booking-saving]");
		if (newSaving && tag) {
			animateMotion(
				tag,
				[
					{ opacity: 0, transform: "scale(.85)" },
					{ opacity: 1, transform: "scale(1)" },
				],
				{ duration: 200, easing: motionEase },
			);
		}
		const stopRoll = rollAmount(section, shown, start, cents);
		return () => {
			clearSweep();
			stopRoll();
		};
	}, [from, to, cents, saving, panelRef]);
	return (range: RentalSearch) => {
		pending.current = range;
	};
}
