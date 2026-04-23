import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName } from "../helpers";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { ResetPasswordPage } from "../pages/reset-password.page";

test.describe("Forgot password", () => {
	test("renders forgot password form", async ({ page }) => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();

		await expect(forgot.emailInput).toBeVisible();
		await expect(forgot.submitButton).toBeVisible();
	});

	test("shows success message after submitting email", async ({ page }) => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();

		await forgot.requestReset("someone@example.com");

		await expect(forgot.successMessage).toBeVisible();
		await expect(forgot.form).not.toBeVisible();
	});

	test("back to login link navigates to login page", async ({ page }) => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();

		await forgot.backToLoginLink.first().click();

		await expect(page).toHaveURL(/\/kirjaudu/);
	});
});

test.describe("Reset password", () => {
	test("renders reset password form", async ({ page }) => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ token: "test-token" });

		await expect(reset.passwordInput).toBeVisible();
		await expect(reset.confirmInput).toBeVisible();
		await expect(reset.submitButton).toBeVisible();
	});

	test("shows error when passwords do not match", async ({ page }) => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ token: "test-token" });

		await reset.resetPassword("NewPassword1!", "DifferentPassword1!");

		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("eivät täsmää");
	});

	test("shows error for invalid token in URL", async ({ page }) => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ error: "INVALID_TOKEN" });

		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("vanhentunut");
	});

	test("submit button is disabled without token", async ({ page }) => {
		const reset = new ResetPasswordPage(page);
		await reset.goto();

		await expect(reset.submitButton).toBeDisabled();
	});
});

test.describe("Login forgot password link", () => {
	test("login page has forgot password link", async ({ page }) => {
		const login = new LoginPage(page);
		await login.goto();

		const forgotLink = page.locator("a[href='/unohdin-salasanan']");
		await expect(forgotLink).toBeVisible();

		await forgotLink.click();
		await expect(page).toHaveURL(/\/unohdin-salasanan/);
	});
});

test.describe("Registration flow", () => {
	test("registration redirects to profile completion", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.register(uniqueName(), uniqueEmail(), "Password123!");

		await expect(page).toHaveURL(/\/taydenna-profiili/);
	});
});

test.describe("Verification banner", () => {
	test("new user sees verification banner after registration", async ({ page }) => {
		const register = new RegisterPage(page);
		await register.goto();

		await register.register(uniqueName(), uniqueEmail(), "Password123!");
		await page.waitForURL(/\/taydenna-profiili/);

		const banner = page.locator("text=Vahvista sähköpostiosoitteesi");
		await expect(banner).toBeVisible();
	});
});
