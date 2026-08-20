import { expect, test } from "@playwright/test";

test("/ilmoitukset redirects to /pyorat/myynti", async ({ page }) => {
	await page.goto("/ilmoitukset");
	await expect(page).toHaveURL(/\/pyorat\/myynti/);
});

test("/tori redirects to /varusteet", async ({ page }) => {
	await page.goto("/tori");
	await expect(page).toHaveURL(/\/varusteet/);
});
