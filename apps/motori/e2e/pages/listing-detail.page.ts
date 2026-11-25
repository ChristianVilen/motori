import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingDetailPage {
	readonly page: Page;
	readonly root: Locator;
	readonly title: Locator;
	readonly back: Locator;
	readonly facts: Locator;
	readonly edit: Locator;
	readonly priceInfo: Locator;
	readonly pricePerDay: Locator;
	readonly locationInfo: Locator;
	readonly bookingSection: Locator;
	readonly bookingDialog: Locator;
	readonly mobileBookButton: Locator;
	readonly notFound: Locator;
	readonly saleContractLink: Locator;
	readonly messageSellerButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.root = page.getByTestId("listing-detail");
		this.title = page.getByTestId("listing-detail-title");
		this.facts = page.getByTestId("listing-facts");
		this.back = page.getByTestId("listing-detail-back");
		this.edit = page.getByTestId("listing-edit-link");
		this.priceInfo = page.getByTestId("price-info");
		this.pricePerDay = page.getByTestId("price-per-day");
		this.locationInfo = page.getByTestId("location-info");
		this.bookingSection = this.root.getByTestId("booking-section");
		this.bookingDialog = page.getByRole("dialog", { name: /Varauspyyntö|Booking request/i });
		this.mobileBookButton = page.getByTestId("mobile-book-button");
		this.notFound = page.getByTestId("listing-not-found");
		this.saleContractLink = page.getByRole("link", { name: "Tee kauppakirja", exact: true });
		this.messageSellerButton = page.getByRole("button", { name: /lähetä viesti/i });
	}

	get summary() {
		return this.root.getByTestId("booking-summary").first();
	}
	get message() {
		return this.page.getByTestId("booking-message");
	}
	get submit() {
		return this.page.getByTestId("booking-submit");
	}
	get success() {
		return this.page.getByTestId("booking-success");
	}
	get blockedNotice() {
		return this.root.getByText("Valinnassa on varattu päivä. Valitse yhtenäinen vapaa jakso.");
	}
	async selectDate(iso: string) {
		const calendar = this.page.locator("#rental-calendar");
		const day = calendar.locator(`button[data-date="${iso}"]`);
		while ((await day.count()) === 0) {
			const next = calendar.locator("button.rdp-button_next");
			if (!(await next.isEnabled())) {
				throw Error(`Date outside calendar: ${iso}`);
			}
			await next.click();
		}
		await day.click();
	}
	async selectFirstTwoDays() {
		const days = this.page.locator("#rental-calendar button[data-date]:not([disabled])");
		await days.nth(0).click();
		await this.summary.getByText("Valitse paluupäivä").waitFor();
		await days.nth(1).click();
		await this.page.getByRole("button", { name: "Jatka pyyntöön" }).waitFor();
	}
	async reload() {
		await this.page.reload();
		await waitForHydration(this.page);
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
