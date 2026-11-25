import { expect, test } from "@playwright/test";
import { HomePage } from "../pages/home.page";

test("selects the language and keeps it on reload", async ({ page }) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const home = new HomePage(page);
	await home.goto();
	await expect(home.language("FI")).toHaveAttribute("aria-pressed", "true");
	await home.language("EN").click();
	await expect(home.navLoginLink).toHaveText("Account");
	await home.goto();
	await expect(home.language("EN")).toHaveAttribute("aria-pressed", "true");
	await home.gotoMissingPage();
	await expect(home.language("EN")).toHaveAttribute("aria-pressed", "true");
	expect(errors).toEqual([]);
	await home.language("FI").click();
	await expect(home.navLoginLink).toHaveText("Oma");
});
