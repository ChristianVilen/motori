import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ResetPasswordPage {
	readonly page: Page;
	readonly form: Locator;
	readonly passwordInput: Locator;
	readonly confirmInput: Locator;
	readonly submitButton: Locator;
	readonly errorMessage: Locator;

	constructor(page: Page) {
		this.page = page;
		this.form = page.getByTestId("reset-password-form");
		this.passwordInput = page.getByTestId("reset-password-input");
		this.confirmInput = page.getByTestId("reset-password-confirm");
		this.submitButton = page.getByTestId("reset-password-submit");
		this.errorMessage = page.getByTestId("reset-password-error");
	}

	async goto(params?: { token?: string; error?: string }) {
		const search = new URLSearchParams();
		if (params?.token) {
			search.set("token", params.token);
		}
		if (params?.error) {
			search.set("error", params.error);
		}
		const qs = search.toString();
		await this.page.goto(`/vaihda-salasana${qs ? `?${qs}` : ""}`);
		await waitForHydration(this.page);
	}

	async resetPassword(password: string, confirm: string) {
		await this.passwordInput.fill(password);
		await this.confirmInput.fill(confirm);
		await this.submitButton.click();
	}
}
