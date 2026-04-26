import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { SettingsPage } from "../pages/settings.page";

test.describe("Delete account flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();
	const password = "Password123!";

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("register fresh account", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, password);
		await page.waitForURL(/\/taydenna-profiili/, { timeout: 10000 });
		await waitForHydration(page);
	});

	test("navigate to settings and open delete dialog", async () => {
		const settings = new SettingsPage(page);
		await settings.goto();
		await settings.deleteTrigger.click();
		await expect(settings.confirmInput).toBeVisible();
		await expect(settings.deleteSubmit).toBeDisabled();
	});

	test("submit stays disabled until POISTA is typed correctly", async () => {
		const settings = new SettingsPage(page);
		await settings.confirmInput.fill("wrong");
		await expect(settings.deleteSubmit).toBeDisabled();
		await settings.confirmInput.fill("POISTA");
		await expect(settings.deleteSubmit).toBeEnabled();
	});

	test("cancel hides the confirmation form", async () => {
		const settings = new SettingsPage(page);
		await settings.deleteCancel.click();
		await expect(settings.confirmInput).not.toBeVisible();
		await expect(settings.deleteTrigger).toBeVisible();
	});

	test("confirming deletion redirects to homepage", async () => {
		const settings = new SettingsPage(page);
		await settings.deleteTrigger.click();
		await settings.confirmInput.fill("POISTA");
		await settings.deleteSubmit.click();
		await expect(page).toHaveURL("/", { timeout: 10000 });
		await waitForHydration(page);
	});

	test("deleted account cannot log in", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, password);
		await expect(login.errorMessage).toBeVisible();
	});
});
