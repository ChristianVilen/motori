import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class RegisterPage {
	readonly page: Page;
	readonly form: Locator;
	readonly firstNameInput: Locator;
	readonly lastNameInput: Locator;
	readonly emailInput: Locator;
	readonly passwordInput: Locator;
	readonly submitButton: Locator;
	readonly errorMessage: Locator;
	readonly loginLink: Locator;
	readonly passwordStrength: Locator;
	readonly passwordStrengthLabel: Locator;
	readonly termsCheckbox: Locator;

	constructor(page: Page) {
		this.page = page;
		this.form = page.getByTestId("register-form");
		this.firstNameInput = page.getByTestId("register-first-name");
		this.lastNameInput = page.getByTestId("register-last-name");
		this.emailInput = page.getByTestId("register-email");
		this.passwordInput = page.getByTestId("register-password");
		this.submitButton = page.getByTestId("register-submit");
		this.errorMessage = page.getByTestId("register-error");
		this.loginLink = page.getByTestId("register-login-link");
		this.passwordStrength = page.getByTestId("password-strength");
		this.passwordStrengthLabel = page.getByTestId("password-strength-label");
		this.termsCheckbox = page.getByTestId("register-terms");
	}

	async goto() {
		await this.page.goto("/rekisteroidy");
		await this.form.waitFor();
		await waitForHydration(this.page);
	}

	async register(name: string, email: string, password: string) {
		const [firstName = "", lastName = ""] = name.split(" ");
		await this.firstNameInput.fill(firstName);
		await this.lastNameInput.fill(lastName);
		await this.emailInput.fill(email);
		// pressSequentially so React's onChange fires per-keystroke for the strength meter
		await this.passwordInput.pressSequentially(password, { delay: 30 });
		await this.termsCheckbox.check();
		await this.submitButton.click();
	}
}
