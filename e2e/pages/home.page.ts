import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class HomePage {
	readonly page: Page;
	readonly heroHeading: Locator;
	readonly searchInput: Locator;
	readonly searchSubmit: Locator;
	readonly browseAllLink: Locator;
	readonly addListingCta: Locator;
	readonly navLoginLink: Locator;
	readonly navLoginMobile: Locator;
	readonly navDashboardLink: Locator;
	readonly navUserMenu: Locator;
	readonly navSignOutLink: Locator;
	readonly loginModal: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heroHeading = page.getByTestId("home-hero-heading");
		this.searchInput = page.getByTestId("home-search-input");
		this.searchSubmit = page.getByTestId("home-search-submit");
		this.browseAllLink = page.getByTestId("home-browse-all");
		this.addListingCta = page.getByTestId("home-add-listing-cta");
		this.navLoginLink = page.getByTestId("nav-login");
		this.navLoginMobile = page.getByTestId("nav-login-mobile");
		this.navDashboardLink = page.getByTestId("nav-dashboard");
		this.navUserMenu = page.getByTestId("nav-user-menu");
		this.navSignOutLink = page.getByTestId("nav-signout");
		this.loginModal = page.getByTestId("login-modal");
	}

	async goto() {
		await this.page.goto("/");
		await this.heroHeading.waitFor();
		await waitForHydration(this.page);
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
