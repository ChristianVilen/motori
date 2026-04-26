import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { LoginPage } from "../pages/login.page";
import { ResetPasswordPage } from "../pages/reset-password.page";

test.describe("Password reset flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("login page has forgot-password link", async () => {
		const login = new LoginPage(page);
		await login.goto();
		const forgotLink = page.locator("a[href='/unohdin-salasanan']");
		await expect(forgotLink).toBeVisible();
		await forgotLink.click();
		await expect(page).toHaveURL(/\/unohdin-salasanan/);
	});

	test("forgot password form renders", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();
		await expect(forgot.emailInput).toBeVisible();
		await expect(forgot.submitButton).toBeVisible();
	});

	test("submitting email shows success message and hides form", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.requestReset("someone@example.com");
		await expect(forgot.successMessage).toBeVisible();
		await expect(forgot.form).not.toBeVisible();
	});

	test("back-to-login link navigates to login", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();
		await forgot.backToLoginLink.first().click();
		await expect(page).toHaveURL(/\/kirjaudu/);
	});

	test("reset form disabled without token", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto();
		await expect(reset.submitButton).toBeDisabled();
	});

	test("reset form renders with token", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ token: "test-token" });
		await expect(reset.passwordInput).toBeVisible();
		await expect(reset.confirmInput).toBeVisible();
		await expect(reset.submitButton).toBeVisible();
	});

	test("mismatched passwords show error", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.resetPassword("NewPassword1!", "DifferentPassword1!");
		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("eivät täsmää");
	});

	test("invalid token error param shows expired message", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ error: "INVALID_TOKEN" });
		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("vanhentunut");
	});
});
