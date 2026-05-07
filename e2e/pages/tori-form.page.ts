import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ToriFormPage {
	readonly page: Page;
	readonly titleInput: Locator;
	readonly categorySelect: Locator;
	readonly conditionSelect: Locator;
	readonly priceInput: Locator;
	readonly descriptionInput: Locator;
	readonly cityInput: Locator;
	readonly submitButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.titleInput = page.locator("#title");
		this.categorySelect = page.locator("#category");
		this.conditionSelect = page.locator("#condition");
		this.priceInput = page.locator("#price");
		this.descriptionInput = page.locator("#description");
		this.cityInput = page.locator("#city");
		this.submitButton = page.getByTestId("tori-form-submit");
	}

	async gotoCreate() {
		await this.page.goto("/tori/uusi");
		await this.titleInput.waitFor();
		await waitForHydration(this.page);
	}

	async fill(data: {
		title: string;
		category: string;
		condition: string;
		price: number;
		city: string;
		description: string;
	}) {
		await this.titleInput.fill(data.title);
		await this.categorySelect.selectOption(data.category);
		await this.conditionSelect.selectOption(data.condition);
		await this.priceInput.fill(String(data.price));
		await this.descriptionInput.fill(data.description);
		await this.cityInput.fill(data.city);
		await this.page.getByRole("option", { name: data.city, exact: true }).first().click();
	}
}
