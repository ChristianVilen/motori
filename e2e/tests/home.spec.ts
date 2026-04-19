import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";

test.describe("Home page", () => {
	test("renders hero and search", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await expect(home.heroHeading).toBeVisible();
		await expect(home.searchInput).toBeVisible();
	});

	test("search navigates to listings with query", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.search("Honda");

		await expect(page).toHaveURL(/\/ilmoitukset\?.*q=Honda/);
	});

	test("region chip navigates to filtered listings", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.clickRegionChip("uusimaa");

		await expect(page).toHaveURL(/\/ilmoitukset\?.*region=uusimaa/);
	});

	test("add listing CTA links to new listing page", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();

		await home.addListingCta.click();

		// Unauthenticated users get redirected to login
		await expect(page).toHaveURL(/\/kirjaudu|\/ilmoitukset\/uusi/);
	});
});
