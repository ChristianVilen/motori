// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, expect, it } from "vitest";
import { computeBookingCost } from "~/lib/bookings";
import { createI18nSync } from "~/lib/i18n/server";
import { BookingPricing } from "./booking-pricing";

afterEach(cleanup);
const i18n = createI18nSync("fi");
it("explains how to see the price before selecting dates", () => {
	render(
		<I18nextProvider i18n={i18n}>
			<BookingPricing range={{}} cost={null} />
		</I18nextProvider>,
	);
	expect(screen.getByText("Valitse nouto- ja palautuspäivä nähdäksesi hinnan.")).toBeVisible();
});
it("shows the pickup, return, weekend rate, total and saving", () => {
	const range = { from: "2026-12-04", to: "2026-12-06" };
	render(
		<I18nextProvider i18n={i18n}>
			<BookingPricing
				range={range}
				cost={computeBookingCost(range.from, range.to, 9500, 55000, 24000)}
			/>
		</I18nextProvider>,
	);
	expect(screen.getByText("Nouto")).toBeVisible();
	expect(screen.getByText("Palautus")).toBeVisible();
	expect(screen.getByText("Viikonloppu pe–su")).toBeVisible();
	expect(screen.getByTestId("booking-total")).toHaveTextContent("240 €");
	expect(screen.getByText("Säästät 45 €")).toBeVisible();
});
