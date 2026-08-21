import { expect, test } from "@playwright/test";
import { waitForHydration } from "../helpers";

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

	test("search overlay traps focus and restores it on close", async ({ page }) => {
		await page.goto("/");
		await waitForHydration(page);
		const opener = page.getByTestId("bottom-nav-search");
		await opener.focus();
		await opener.press("Enter");

		const dialog = page.getByRole("dialog", { name: "Haku" });
		await expect(dialog.getByPlaceholder(/etsi|search/i)).toBeFocused();

		const first = dialog.getByRole("button", { name: "Sulje haku" });
		const last = dialog.locator("#mobile-search-city");
		await first.focus();
		await page.keyboard.press("Shift+Tab");
		await expect(last).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(first).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
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
