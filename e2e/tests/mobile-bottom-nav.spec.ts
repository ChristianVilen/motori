import { expect, test } from "@playwright/test";

test.describe("mobile bottom nav", () => {
	test("search overlay submits query", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-search").click();
		const input = page.getByPlaceholder(/etsi|search/i);
		await expect(input).toBeVisible();
		await input.fill("honda");
		await input.press("Enter");
		await expect(page).toHaveURL(/\/pyorat\/myynti\?.*q=honda/);
	});

	test("add tab opens login modal when signed out", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-add").click();
		await expect(page.getByTestId("login-modal")).toBeVisible();
	});

	test("messages tab opens login modal when signed out", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-messages").click();
		await expect(page.getByTestId("login-modal")).toBeVisible();
	});

	test("header sign-in button opens login modal when signed out", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("nav-login-mobile").click();
		await expect(page.getByTestId("login-modal")).toBeVisible();
	});
});
