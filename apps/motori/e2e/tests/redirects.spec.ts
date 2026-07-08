import { expect, test } from "@playwright/test";

test("/ilmoitukset redirects to /pyorat/vuokraus", async ({ page }) => {
	await page.goto("/ilmoitukset");
	await expect(page).toHaveURL(/\/pyorat\/vuokraus/);
});

test("/tori redirects to /varusteet", async ({ page }) => {
	await page.goto("/tori");
	await expect(page).toHaveURL(/\/varusteet/);
});
