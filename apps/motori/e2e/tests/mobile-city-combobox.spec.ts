import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { ListingsPage } from "../pages/listings.page";

// Keyboard walkthrough for the CitySelect combobox (APG pattern, #189).
// Driven through the mobile search overlay because it needs no auth state.
test.describe("city combobox", () => {
	test("keyboard walkthrough: filter, arrow, Enter commits", async ({ page }) => {
		const home = new HomePage(page);
		await home.openSearch();

		const input = home.overlayCity;
		await expect(input).toBeVisible();
		await expect(input).toHaveAttribute("role", "combobox");
		await expect(input).toHaveAttribute("aria-expanded", "false");

		await input.click();
		await input.pressSequentially("helsin");

		await expect(input).toHaveAttribute("aria-expanded", "true");

		await expect(home.cityOption("Helsinki")).toBeVisible();

		await input.press("ArrowDown");
		await expect(input).toHaveAttribute("aria-activedescendant", /.+/);

		await input.press("Enter");
		await expect(page).toHaveURL(/\/\?city=Helsinki$/);
		await expect(home.clearCity).toHaveText(/Helsinki/);
		await expect(home.cards.first()).toBeVisible();
		for (const facts of await home.cardFacts.allTextContents()) {
			expect(facts).toMatch(/Helsinki$/);
		}
		await home.clearCity.click();
		await expect(page).toHaveURL("/");
	});

	test("commit-on-type: a fully typed city name commits without Enter", async ({ page }) => {
		const home = new HomePage(page);
		const rentals = new ListingsPage(page);
		await rentals.goto({ q: "Honda", region: "uusimaa" });
		await rentals.mobileTrigger.click();

		await home.overlayInput.fill("Yamaha");
		const input = home.overlayCity;
		await input.click();
		await input.pressSequentially("espoo");

		await expect(page).toHaveURL(
			(url) =>
				url.searchParams.get("city") === "Espoo" &&
				url.searchParams.get("view") === "map" &&
				url.searchParams.get("q") === "Yamaha" &&
				url.searchParams.get("region") === "uusimaa",
		);
		await expect(rentals.mapCityPanel).toContainText("Espoo");
	});
});
