import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";
import { ListingsPage } from "../pages/listings.page";

test.describe("mobile bottom nav", () => {
	test("search overlay submits query", async ({ page }) => {
		const home = new HomePage(page);
		await home.openSearch();
		const input = home.overlayInput;
		await expect(input).toBeVisible();
		await input.fill("honda");
		await input.press("Enter");
		await expect(page).toHaveURL(/\/\?q=honda$/);
		const rentals = new ListingsPage(page);
		await rentals.goto({ q: "Honda", region: "uusimaa" });
		await rentals.mobileTrigger.click();
		await expect(input).toHaveValue("Honda");
		await input.fill("Yamaha");
		await input.press("Enter");
		await expect(page).toHaveURL(
			(u) => u.searchParams.get("q") === "Yamaha" && u.searchParams.get("region") === "uusimaa",
		);
		await rentals.search("");
		await expect(page).toHaveURL(
			(u) => !u.searchParams.has("q") && u.searchParams.get("region") === "uusimaa",
		);
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
