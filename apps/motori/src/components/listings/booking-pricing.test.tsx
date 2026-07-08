// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingPricing } from "./booking-pricing";

vi.mock("~/lib/i18n", () => ({
	formatEur: (cents: number) => `${(cents / 100).toFixed(0)} €`,
}));

const t = (key: string) => key;

describe("BookingPricing", () => {
	it("shows day rate", () => {
		render(
			<BookingPricing
				cost={null}
				maxStayError={false}
				fromDate={null}
				toDate={null}
				from={null}
				to={null}
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		expect(screen.getByText("detail.pricing.perDay")).toBeInTheDocument();
	});

	it("shows week and weekend rate labels when provided", () => {
		const { container } = render(
			<BookingPricing
				cost={null}
				maxStayError={false}
				fromDate={null}
				toDate={null}
				from={null}
				to={null}
				pricePerDayCents={5000}
				pricePerWeekCents={30000}
				pricePerWeekendCents={12000}
				t={t}
			/>,
		);

		const spans = container.querySelectorAll("span.text-xs.text-muted");
		const texts = [...spans].map((s) => s.textContent);
		expect(texts.some((t) => t?.includes("detail.pricing.perWeek"))).toBe(true);
		expect(texts.some((t) => t?.includes("detail.pricing.perWeekend"))).toBe(true);
	});

	it("shows select-dates hint when no dates selected", () => {
		const { container } = render(
			<BookingPricing
				cost={null}
				maxStayError={false}
				fromDate={null}
				toDate={null}
				from={null}
				to={null}
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		// Footer area shows the hint
		const footer = container.querySelector(".rounded-xl.border");
		expect(footer).toHaveTextContent("booking.calendar.selectDatesHint");
	});

	it("shows select-return hint when only from is selected", () => {
		const { container } = render(
			<BookingPricing
				cost={null}
				maxStayError={false}
				fromDate={new Date("2026-06-01")}
				toDate={null}
				from="2026-06-01"
				to={null}
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		const footer = container.querySelector(".rounded-xl.border");
		expect(footer).toHaveTextContent("booking.calendar.selectReturnHint");
	});

	it("shows total cost when cost is computed", () => {
		const { container } = render(
			<BookingPricing
				cost={{ totalCents: 15000, days: 3, label: null }}
				maxStayError={false}
				fromDate={new Date("2026-06-01")}
				toDate={new Date("2026-06-03")}
				from="2026-06-01"
				to="2026-06-03"
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		// Footer shows total
		const footer = container.querySelector(".rounded-xl.border");
		expect(footer).toHaveTextContent("150 €");
	});

	it("shows week badge when label is week", () => {
		render(
			<BookingPricing
				cost={{ totalCents: 30000, days: 7, label: "week" }}
				maxStayError={false}
				fromDate={new Date("2026-06-01")}
				toDate={new Date("2026-06-07")}
				from="2026-06-01"
				to="2026-06-07"
				pricePerDayCents={5000}
				pricePerWeekCents={30000}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		expect(screen.getByText("booking.calendar.weekBadge")).toBeInTheDocument();
	});

	it("shows max stay error when flagged", () => {
		render(
			<BookingPricing
				cost={{ totalCents: 15000, days: 3, label: null }}
				maxStayError={true}
				fromDate={new Date("2026-06-01")}
				toDate={new Date("2026-06-03")}
				from="2026-06-01"
				to="2026-06-03"
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		expect(screen.getByText("booking.calendar.maxStayError")).toBeInTheDocument();
	});

	it("renders pickup and return day numbers in hero", () => {
		render(
			<BookingPricing
				cost={{ totalCents: 10000, days: 2, label: null }}
				maxStayError={false}
				fromDate={new Date("2026-06-15")}
				toDate={new Date("2026-06-16")}
				from="2026-06-15"
				to="2026-06-16"
				pricePerDayCents={5000}
				pricePerWeekCents={null}
				pricePerWeekendCents={null}
				t={t}
			/>,
		);

		expect(screen.getByText("15")).toBeInTheDocument();
		expect(screen.getByText("16")).toBeInTheDocument();
	});
});
