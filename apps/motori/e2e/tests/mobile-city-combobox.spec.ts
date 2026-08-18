import { expect, test } from "@playwright/test";
import { waitForHydration } from "../helpers";

// Keyboard walkthrough for the CitySelect combobox (APG pattern, #189).
// Driven through the mobile search overlay because it needs no auth state.
test.describe("city combobox", () => {
	test("keyboard walkthrough: filter, arrow, Enter commits", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("bottom-nav-search").click();

		const input = page.locator("#mobile-search-city");
		await expect(input).toBeVisible();
		await expect(input).toHaveAttribute("role", "combobox");
		await expect(input).toHaveAttribute("aria-expanded", "false");

		await input.click();
		await input.pressSequentially("helsin");

		await expect(input).toHaveAttribute("aria-expanded", "true");
		const listbox = page.getByRole("listbox");
		await expect(listbox).toBeVisible();
		await expect(page.getByRole("option", { name: "Helsinki", exact: true })).toBeVisible();

		await input.press("ArrowDown");
		await expect(input).toHaveAttribute("aria-activedescendant", /.+/);

		await input.press("Enter");
		await expect(page).toHaveURL(/\/pyorat\/myynti\?.*city=Helsinki/);
	});

	test("commit-on-type: a fully typed city name commits without Enter", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("bottom-nav-search").click();

		const input = page.locator("#mobile-search-city");
		await input.click();
		await input.pressSequentially("espoo");

		await expect(page).toHaveURL(/\/pyorat\/myynti\?.*city=Espoo/);
	});
});
