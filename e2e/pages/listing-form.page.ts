import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingFormPage {
	readonly page: Page;
	readonly titleInput: Locator;
	readonly makeTrigger: Locator;
	readonly yearInput: Locator;
	readonly motorcycleTypeSelect: Locator;
	readonly pricePerDayInput: Locator;
	readonly cityInput: Locator;
	readonly regionSelect: Locator;
	readonly descriptionInput: Locator;
	readonly submitButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.titleInput = page.locator("#title");
		this.makeTrigger = page.locator("#make-trigger");
		this.yearInput = page.locator("#year");
		this.motorcycleTypeSelect = page.locator("#motorcycle_type");
		this.pricePerDayInput = page.locator("#price_per_day");
		this.cityInput = page.locator("#city");
		this.regionSelect = page.locator("#region");
		this.descriptionInput = page.locator("#description");
		this.submitButton = page.getByTestId("listing-form-submit");
	}

	async gotoCreate() {
		await this.page.goto("/ilmoitukset/uusi");
		await this.titleInput.waitFor();
		await waitForHydration(this.page);
	}

	async selectMake(name: string) {
		await this.makeTrigger.click();
		await this.page.getByPlaceholder("Hae...").fill(name);
		await this.page.getByRole("button", { name, exact: true }).first().click();
	}

	async selectMotorcycleType(label: string) {
		await this.motorcycleTypeSelect.click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async selectRegion(label: string) {
		await this.regionSelect.click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async fill(data: {
		title: string;
		make: string;
		year: number;
		motorcycleType: string;
		pricePerDay: number;
		city: string;
		region: string;
		description: string;
	}) {
		await this.page.getByTestId("category-tile-rental").click();
		await this.titleInput.fill(data.title);
		await this.selectMake(data.make);
		await this.yearInput.fill(String(data.year));
		await this.selectMotorcycleType(data.motorcycleType);
		await this.pricePerDayInput.fill(String(data.pricePerDay));
		await this.cityInput.fill(data.city);
		await this.page.getByRole("option", { name: data.city, exact: true }).first().click();
		await this.descriptionInput.fill(data.description);
	}
}
