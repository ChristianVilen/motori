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

	constructor(page: Page, root?: Locator) {
		this.page = page;
		const scope = root ?? page;
		this.form = scope.getByTestId("login-form");
		this.emailInput = this.form.getByTestId("login-email");
		this.passwordInput = this.form.getByTestId("login-password");
		this.submitButton = this.form.getByTestId("login-submit");
		this.errorMessage = this.form.getByTestId("login-error");
		this.registerLink = scope.getByTestId("login-register-link");
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
