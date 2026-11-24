import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class HomePage {
	readonly page: Page;
	readonly wordmark: Locator;
	readonly feedHeading: Locator;
	readonly searchInput: Locator;
	readonly cards: Locator;
	readonly clearCity: Locator;
	readonly addListingCta: Locator;
	readonly navLoginLink: Locator;
	readonly navLoginMobile: Locator;
	readonly navAddListing: Locator;
	readonly mobileSearch: Locator;
	readonly searchDialog: Locator;
	readonly overlayInput: Locator;
	readonly overlayClose: Locator;
	readonly overlayCity: Locator;
	readonly navUserMenu: Locator;
	readonly navSignOutLink: Locator;
	readonly loginModal: Locator;

	constructor(page: Page) {
		this.page = page;
		this.wordmark = page.getByRole("link", { name: "Motori", exact: true });
		this.feedHeading = page.getByTestId("home-feed-heading");
		this.searchInput = page.getByTestId("site-search-input");
		this.cards = page.getByTestId("listing-card");
		this.clearCity = page.getByTestId("clear-city");
		this.addListingCta = page.getByTestId("home-add-listing-cta");
		this.navLoginLink = page.getByTestId("nav-login");
		this.navLoginMobile = page.getByTestId("nav-login-mobile");
		this.navAddListing = page.getByTestId("nav-add-listing");
		this.mobileSearch = page.getByTestId("site-search-trigger");
		this.searchDialog = page.getByRole("dialog", { name: "Haku" });
		this.overlayInput = this.searchDialog.getByRole("searchbox");
		this.overlayCity = this.searchDialog.getByRole("combobox");
		this.overlayClose = this.searchDialog.getByRole("button", { name: "Sulje haku" });
		this.navUserMenu = page.getByTestId("nav-user-menu");
		this.navSignOutLink = page.getByTestId("nav-signout");
		this.loginModal = page.getByTestId("login-modal");
	}

	async goto() {
		await this.page.goto("/");
		await this.feedHeading.waitFor();
		await waitForHydration(this.page);
	}

	bottomTab(tab: "add" | "messages" | "favorites") {
		return this.page.getByTestId(`bottom-nav-${tab}`);
	}

	cityOption(name: string) {
		return this.page.getByRole("listbox").getByRole("option", { name, exact: true });
	}

	async openSearch() {
		await this.goto();
		await this.mobileSearch.click();
	}

	language(code: "FI" | "EN") {
		return this.page.getByRole("button", { name: new RegExp(`${code}$`) });
	}

	async search(query: string) {
		await this.searchInput.fill(query);
		await this.searchInput.press("Enter");
	}

	categoryChip(category: string) {
		return this.page.getByTestId(`home-category-${category}`);
	}

	get cardFacts() {
		return this.cards.getByTestId("listing-card-facts");
	}
}
