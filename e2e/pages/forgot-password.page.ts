import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ForgotPasswordPage {
	readonly page: Page;
	readonly form: Locator;
	readonly emailInput: Locator;
	readonly submitButton: Locator;
	readonly successMessage: Locator;
	readonly backToLoginLink: Locator;

	constructor(page: Page) {
		this.page = page;
		this.form = page.getByTestId("forgot-password-form");
		this.emailInput = page.getByTestId("forgot-password-email");
		this.submitButton = page.getByTestId("forgot-password-submit");
		this.successMessage = page.locator("text=Jos tili löytyy");
		this.backToLoginLink = page.locator("a[href='/kirjaudu']");
	}

	async goto() {
		await this.page.goto("/unohdin-salasanan");
		await waitForHydration(this.page);
	}

	async requestReset(email: string) {
		await this.emailInput.fill(email);
		await this.submitButton.click();
	}
}
