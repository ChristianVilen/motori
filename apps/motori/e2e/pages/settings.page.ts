import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class SettingsPage {
	readonly page: Page;
	readonly deleteSection: Locator;
	readonly deleteTrigger: Locator;
	readonly confirmInput: Locator;
	readonly deleteSubmit: Locator;
	readonly deleteCancel: Locator;
	readonly deleteError: Locator;

	constructor(page: Page) {
		this.page = page;
		this.deleteSection = page.getByTestId("delete-account-section");
		this.deleteTrigger = page.getByTestId("delete-account-trigger");
		this.confirmInput = page.getByTestId("delete-account-confirm-input");
		this.deleteSubmit = page.getByTestId("delete-account-submit");
		this.deleteCancel = page.getByTestId("delete-account-cancel");
		this.deleteError = page.getByTestId("delete-account-error");
	}

	async goto() {
		await this.page.goto("/profiili/asetukset");
		await this.deleteSection.waitFor();
		await waitForHydration(this.page);
	}
}
