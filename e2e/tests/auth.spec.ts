import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName } from "../helpers";
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

		await expect(page).toHaveURL(/\/auth\/register/);
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

		await expect(page).toHaveURL(/\/auth\/login/);
	});

	test("shows error for duplicate email", async ({ page }) => {
		const register = new RegisterPage(page);
		const email = uniqueEmail();
		const name = uniqueName();

		// First registration succeeds
		await register.goto();
		await register.register(name, email, "Password123!");
		await expect(page).not.toHaveURL(/\/auth\/register/);

		// Second attempt with the same email surfaces the error
		await register.goto();
		await register.register(name, email, "Password123!");

		await expect(register.errorMessage).toBeVisible();
	});

	test("successful registration redirects away from register page", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.register(uniqueName(), uniqueEmail(), "Password123!");

		await expect(page).not.toHaveURL(/\/auth\/register/);
	});
});
