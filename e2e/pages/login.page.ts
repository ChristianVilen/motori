import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class LoginPage {
	readonly page: Page;
	readonly form: Locator;
	readonly emailInput: Locator;
	readonly passwordInput: Locator;
	readonly submitButton: Locator;
	readonly errorMessage: Locator;
	readonly registerLink: Locator;

	constructor(page: Page) {
		this.page = page;
		this.form = page.getByTestId("login-form");
		this.emailInput = page.getByTestId("login-email");
		this.passwordInput = page.getByTestId("login-password");
		this.submitButton = page.getByTestId("login-submit");
		this.errorMessage = page.getByTestId("login-error");
		this.registerLink = page.getByTestId("login-register-link");
	}

	async goto() {
		await this.page.goto("/kirjaudu");
		await this.form.waitFor();
		await waitForHydration(this.page);
	}

	async login(email: string, password: string) {
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
		await this.submitButton.click();
	}
}
