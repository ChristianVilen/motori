import { expect, test } from "@playwright/test";
import { waitForHydration } from "../helpers";

test.describe("Language selector", () => {
	test("toggles UI text between Finnish and English", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);

		// Default is Finnish (Playwright locale is fi-FI)
		await expect(page.locator("nav a", { hasText: "Varusteet" })).toBeVisible();

		// Switch to English
		await page.getByRole("button", { name: /EN/i }).click();
		await expect(page.locator("nav a", { hasText: "Gear" })).toBeVisible();

		// Switch back to Finnish
		await page.getByRole("button", { name: /FI/i }).click();
		await expect(page.locator("nav a", { hasText: "Varusteet" })).toBeVisible();
	});
});
