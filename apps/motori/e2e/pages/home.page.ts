import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class HomePage {
	readonly page: Page;
	readonly wordmark: Locator;
	readonly heroHeading: Locator;
	readonly searchInput: Locator;
	readonly searchSubmit: Locator;
	readonly browseAllLink: Locator;
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
		this.heroHeading = page.getByTestId("home-hero-heading");
		this.searchInput = page.getByTestId("home-search-input");
		this.searchSubmit = page.getByTestId("home-search-submit");
		this.browseAllLink = page.getByTestId("home-browse-all");
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
		await this.heroHeading.waitFor();
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
		await this.searchSubmit.click();
	}

	regionChip(slug: string): Locator {
		return this.page.getByTestId(`home-chip-${slug}`);
	}

	async clickRegionChip(slug: string) {
		await this.regionChip(slug).click();
	}
}
