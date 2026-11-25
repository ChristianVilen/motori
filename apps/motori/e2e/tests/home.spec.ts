import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";

test.describe("Home page", () => {
	test("shows the feed heading and listing cards", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await expect(home.wordmark).toHaveAttribute("href", "/");
		await expect(home.feedHeading).toHaveText("Uusimmat ilmoitukset");
		await expect(home.cards.first()).toBeVisible();
	});

	test("search navigates to listings with query", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.search("Honda");

		await expect(page).toHaveURL(/\/\?q=Honda$/);
	});

	test("the gear chip opens the gear category", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.categoryChip("gear").click();

		await expect(page).toHaveURL(/\/varusteet$/);
	});

	test("a price sort leaves rentals out and says so", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto({ sort: "price_asc" });

		await expect(home.rentalsExcludedNote).toBeVisible();
		await expect(home.showRentalsLink).toHaveAttribute("href", "/pyorat/vuokraus");
		await expect(home.cards.first()).toBeVisible();
		await expect(home.rentalPills).toHaveCount(0);
	});

	test("add listing CTA links to new listing page", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.addListingCta.click();

		// Unauthenticated users get redirected to login
		await expect(page).toHaveURL(/\/kirjaudu|\/ilmoitukset\/uusi/, {
			timeout: 10000,
		});
	});
});
