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
	readonly bookingSection: Locator;
	readonly bookingDialog: Locator;
	readonly mobileBookButton: Locator;
	readonly notFound: Locator;
	readonly saleContractLink: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = page.getByTestId("listing-detail");
		this.title = page.getByTestId("listing-detail-title");
		this.back = page.getByTestId("listing-detail-back");
		this.edit = page.getByTestId("listing-edit-link");
		this.priceInfo = page.getByTestId("price-info");
		this.pricePerDay = page.getByTestId("price-per-day");
		this.locationInfo = page.getByTestId("location-info");
		this.bookingSection = this.root.getByTestId("booking-section");
		this.bookingDialog = page.getByRole("dialog", { name: /Saatavuus|Availability/ });
		this.mobileBookButton = page.getByTestId("mobile-book-button");
		this.notFound = page.getByTestId("listing-not-found");
		this.saleContractLink = page.getByRole("link", { name: "Tee kauppakirja", exact: true });
	}

	async goto(shortId: string, slug: string) {
		await this.page.goto(`/pyorat/vuokraus/${shortId}/${slug}`);
		await waitForHydration(this.page);
	}

	async gotoSale(shortId: string, slug: string) {
		await this.page.goto(`/pyorat/myynti/${shortId}/${slug}`);
		await waitForHydration(this.page);
	}
}
