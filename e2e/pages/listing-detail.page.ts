import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingDetailPage {
	readonly page: Page;
	readonly root: Locator;
	readonly title: Locator;
	readonly back: Locator;
	readonly edit: Locator;
	readonly priceInfo: Locator;
	readonly pricePerDay: Locator;
	readonly locationInfo: Locator;
	readonly ownerContactReveal: Locator;
	readonly ownerContact: Locator;
	readonly notFound: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = page.getByTestId("listing-detail");
		this.title = page.getByTestId("listing-detail-title");
		this.back = page.getByTestId("listing-detail-back");
		this.edit = page.getByTestId("listing-edit-link");
		this.priceInfo = page.getByTestId("price-info");
		this.pricePerDay = page.getByTestId("price-per-day");
		this.locationInfo = page.getByTestId("location-info");
		this.ownerContactReveal = page.getByTestId("owner-contact-reveal");
		this.ownerContact = page.getByTestId("owner-contact");
		this.notFound = page.getByTestId("listing-not-found");
	}

	async goto(listingId: string) {
		await this.page.goto(`/ilmoitukset/${listingId}`);
		await waitForHydration(this.page);
	}

	async revealOwnerContact() {
		await this.ownerContactReveal.click();
	}
}
