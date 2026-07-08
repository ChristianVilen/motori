import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { HomePage } from "../pages/home.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { SettingsPage } from "../pages/settings.page";

test.describe("Auth flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();
	const password = "Password123!";
	const name = uniqueName();

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("login page renders and links to register", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await expect(login.emailInput).toBeVisible();
		await expect(login.passwordInput).toBeVisible();
		await login.registerLink.click();
		await expect(page).toHaveURL(/\/rekisteroidy/);
	});

	test("register form shows password strength indicator", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.passwordInput.pressSequentially("weak", { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Heikko");
		await register.passwordInput.selectText();
		await register.passwordInput.pressSequentially(password, { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Vahva");
	});

	test("register new account redirects to profile completion", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		const [firstName = "", lastName = ""] = name.split(" ");
		await register.firstNameInput.fill(firstName);
		await register.lastNameInput.fill(lastName);
		await register.emailInput.fill(email);
		await register.passwordInput.pressSequentially(password, { delay: 30 });
		await register.termsCheckbox.check();
		await register.submitButton.click();
		await expect(page).toHaveURL(/\/taydenna-profiili/, { timeout: 10000 });
	});

	test("sign out clears the session", async () => {
		const home = new HomePage(page);
		await home.goto();
		await waitForHydration(page);
		await home.navUserMenu.click();
		await home.navSignOutLink.click();
		await expect(home.navLoginLink).toBeVisible({ timeout: 5000 });
		await expect(home.navDashboardLink).not.toBeVisible();
	});

	test("wrong credentials show login error", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, "wrongpassword");
		await expect(login.errorMessage).toBeVisible();
	});

	test("correct credentials restore the session", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, password);
		const home = new HomePage(page);
		await expect(home.navDashboardLink).toBeVisible({ timeout: 10000 });
	});

	test("login modal from nav works", async () => {
		const home = new HomePage(page);
		await home.goto();
		await waitForHydration(page);
		await home.navUserMenu.click();
		await home.navSignOutLink.click();
		await expect(home.navLoginLink).toBeVisible({ timeout: 5000 });
		await home.navLoginLink.click();
		await expect(home.loginModal).toBeVisible();
		const modalLogin = new LoginPage(page, home.loginModal);
		await modalLogin.login(email, password);
		await expect(home.loginModal).not.toBeVisible({ timeout: 10000 });
		await expect(home.navDashboardLink).toBeVisible();
	});

	// Delete account — continues the serial chain with the same user
	test("settings delete dialog opens and submit is disabled", async () => {
		const settings = new SettingsPage(page);
		await settings.goto();
		await settings.deleteTrigger.click();
		await expect(settings.confirmInput).toBeVisible();
		await expect(settings.deleteSubmit).toBeDisabled();
	});

	test("delete submit stays disabled until POISTA is typed", async () => {
		const settings = new SettingsPage(page);
		await settings.confirmInput.fill("wrong");
		await expect(settings.deleteSubmit).toBeDisabled();
		await settings.confirmInput.fill("POISTA");
		await expect(settings.deleteSubmit).toBeEnabled();
	});

	test("delete cancel hides the confirmation form", async () => {
		const settings = new SettingsPage(page);
		await settings.deleteCancel.click();
		await expect(settings.confirmInput).not.toBeVisible();
		await expect(settings.deleteTrigger).toBeVisible();
	});

	test("confirming account deletion redirects to homepage", async () => {
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

test.describe("Duplicate email", () => {
	test("register shows error for duplicate email", async ({ page }) => {
		const register = new RegisterPage(page);
		const dupEmail = uniqueEmail();

		await register.goto();
		await register.register(uniqueName(), dupEmail, "Password123!");
		await expect(page).not.toHaveURL(/\/rekisteroidy/, { timeout: 10000 });

		await register.goto();
		await register.register(uniqueName(), dupEmail, "Password123!");
		await expect(register.errorMessage).toBeVisible();
	});
});
