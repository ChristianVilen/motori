import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { SettingsPage } from "../pages/settings.page";

// Each test registers a fresh user since account deletion destroys the account.

test.describe("Delete account", () => {
	test("submit button is disabled until POISTA is typed", async ({ page }) => {
		const email = uniqueEmail();
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, "Password123!");
		await page.waitForURL((url) => url.pathname !== "/rekisteroidy");
		await waitForHydration(page);

		const settings = new SettingsPage(page);
		await settings.goto();

		await settings.deleteTrigger.click();
		await expect(settings.deleteSubmit).toBeDisabled();

		await settings.confirmInput.fill("wrong");
		await expect(settings.deleteSubmit).toBeDisabled();

		await settings.confirmInput.fill("POISTA");
		await expect(settings.deleteSubmit).toBeEnabled();
	});

	test("cancel hides the confirmation form", async ({ page }) => {
		const email = uniqueEmail();
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, "Password123!");
		await page.waitForURL((url) => url.pathname !== "/rekisteroidy");
		await waitForHydration(page);

		const settings = new SettingsPage(page);
		await settings.goto();

		await settings.deleteTrigger.click();
		await expect(settings.confirmInput).toBeVisible();

		await settings.deleteCancel.click();
		await expect(settings.confirmInput).not.toBeVisible();
		await expect(settings.deleteTrigger).toBeVisible();
	});

	test("deletes account and redirects to homepage", async ({ page }) => {
		const email = uniqueEmail();
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, "Password123!");
		await page.waitForURL((url) => url.pathname !== "/rekisteroidy");
		await waitForHydration(page);

		const settings = new SettingsPage(page);
		await settings.goto();

		await settings.deleteTrigger.click();
		await settings.confirmInput.fill("POISTA");
		await settings.deleteSubmit.click();

		await expect(page).toHaveURL("/", { timeout: 10000 });
		await waitForHydration(page);

		// Trying to log in with the deleted account should fail
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, "Password123!");
		await expect(login.errorMessage).toBeVisible();
	});
});
