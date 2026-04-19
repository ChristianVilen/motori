import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName } from "../helpers";
import { HomePage } from "../pages/home.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";

test.describe("Login", () => {
	test("renders login form", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();

		await expect(login.emailInput).toBeVisible();
		await expect(login.passwordInput).toBeVisible();
		await expect(login.submitButton).toBeVisible();
	});

	test("shows error on wrong credentials", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();

		await login.login("wrong@example.com", "wrongpassword");

		await expect(login.errorMessage).toBeVisible();
	});

	test("links to register page", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();

		await login.registerLink.click();

		await expect(page).toHaveURL(/\/rekisteroidy/);
	});
});

test.describe("Register", () => {
	test("renders registration form", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await expect(register.nameInput).toBeVisible();
		await expect(register.emailInput).toBeVisible();
		await expect(register.passwordInput).toBeVisible();
		await expect(register.submitButton).toBeVisible();
	});

	test("shows password strength indicator while typing", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.passwordInput.pressSequentially("weak", { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Heikko");

		await register.passwordInput.selectText();
		await register.passwordInput.pressSequentially("StrongPass1!", { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Vahva");
	});

	test("links back to login", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.loginLink.click();

		await expect(page).toHaveURL(/\/kirjaudu/);
	});

	test("shows error for duplicate email", async ({ page }) => {
		const register = new RegisterPage(page);
		const email = uniqueEmail();
		const name = uniqueName();

		// First registration succeeds
		await register.goto();
		await register.register(name, email, "Password123!");
		await page.waitForURL((url) => url.pathname !== "/rekisteroidy");

		// Second attempt with the same email surfaces the error
		await register.goto();
		await register.register(name, email, "Password123!");

		await expect(register.errorMessage).toBeVisible();
	});

	test("successful registration redirects away from register page", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.register(uniqueName(), uniqueEmail(), "Password123!");

		await expect(page).not.toHaveURL(/\/rekisteroidy/);
	});
});

test.describe("Navbar", () => {
	test("reflects auth state correctly", async ({ page }) => {
		const home = new HomePage(page);
		const register = new RegisterPage(page);
		const login = new LoginPage(page);
		const email = uniqueEmail();
		const name = uniqueName();
		const password = "Password123!";

		// 1. Register a new user
		await register.goto();
		await register.register(name, email, password);
		await expect(home.navDashboardLink).toBeVisible();

		// 2. Log out
		await home.navSignOutLink.click();
		await expect(home.navLoginLink).toBeVisible();
		await expect(home.navDashboardLink).not.toBeVisible();

		// 3. Log back in from the modal
		await home.navLoginLink.click();
		await expect(home.loginModal).toBeVisible();
		await login.login(email, password);
		await expect(home.loginModal).not.toBeVisible();
		await expect(home.navDashboardLink).toBeVisible();
	});
});
