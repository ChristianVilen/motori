import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";

test.describe("mobile bottom nav", () => {
	test("search overlay submits query", async ({ page }) => {
		const home = new HomePage(page);
		await home.openSearch();
		const input = home.overlayInput;
		await expect(input).toBeVisible();
		await input.fill("honda");
		await input.press("Enter");
		await expect(page).toHaveURL(/\/pyorat\/myynti\?.*q=honda/);
	});

	test("search overlay traps focus and restores it on close", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();
		const opener = home.mobileSearch;
		await opener.focus();
		await opener.press("Enter");

		const dialog = home.searchDialog;
		await expect(home.overlayInput).toBeFocused();

		const first = home.overlayClose;
		const last = home.overlayCity;
		await first.focus();
		await page.keyboard.press("Shift+Tab");
		await expect(last).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(first).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
	});

	for (const tab of ["add", "favorites", "messages"] as const) {
		test(`${tab} tab opens login modal when signed out`, async ({ page }) => {
			const home = new HomePage(page);
			await home.goto();
			await home.bottomTab(tab).click();
			await expect(home.loginModal).toBeVisible();
		});
	}
	test("header sign-in button opens login modal when signed out", async ({ page }) => {
		const home = new HomePage(page);
		await home.goto();
		await home.navLoginMobile.click();
		await expect(home.loginModal).toBeVisible();
	});
});
