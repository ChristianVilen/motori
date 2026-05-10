import { expect, test } from "@playwright/test";

test("sale browse page loads", async ({ page }) => {
	await page.goto("/pyorat/myynti");
	await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("rental browse page loads", async ({ page }) => {
	await page.goto("/pyorat/vuokraus");
	await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("gear browse page loads", async ({ page }) => {
	await page.goto("/varusteet");
	await expect(page.getByTestId("listings-grid")).toBeVisible();
});

test("parts browse page loads", async ({ page }) => {
	await page.goto("/varaosat");
	await expect(page.getByTestId("listings-grid")).toBeVisible();
});
