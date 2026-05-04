import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingsPage {
	readonly page: Page;
	readonly searchInput: Locator;
	readonly searchSubmit: Locator;
	readonly resultCount: Locator;
	readonly totalCount: Locator;
	readonly regionLabel: Locator;
	readonly grid: Locator;
	readonly cards: Locator;
	readonly loadMoreButton: Locator;
	readonly emptyState: Locator;
	readonly filterDrawerToggle: Locator;

	constructor(page: Page) {
		this.page = page;
		this.searchInput = page.getByTestId("listings-search-input");
		this.searchSubmit = page.getByTestId("listings-search-submit");
		this.resultCount = page.getByTestId("listings-result-count");
		this.totalCount = page.getByTestId("listings-total-count");
		this.regionLabel = page.getByTestId("listings-region-label");
		this.grid = page.getByTestId("listings-grid");
		this.cards = page.getByTestId("listing-card");
		this.loadMoreButton = page.getByTestId("listings-load-more");
		this.emptyState = page.getByTestId("listings-empty-state");
		this.filterDrawerToggle = page.getByTestId("listings-filter-drawer-toggle");
	}

	async goto(params?: Record<string, string>) {
		const query = params ? `?${new URLSearchParams(params).toString()}` : "";
		await this.page.goto(`/ilmoitukset${query}`);
		await this.resultCount.waitFor();
		await waitForHydration(this.page);
	}

	async search(query: string) {
		await this.searchInput.fill(query);
		await this.searchSubmit.click();
	}

	cardById(id: string): Locator {
		return this.page.locator(`[data-testid="listing-card"][data-listing-id="${id}"]`);
	}

	async clickFirstCard() {
		await this.cards.first().click();
	}

	async loadMore() {
		await this.loadMoreButton.click();
	}

	// ── Filter helpers (desktop sidebar) ──

	sidebarMakeSelect(): Locator {
		return this.page.getByTestId("filter-make");
	}

	sidebarCcMin(): Locator {
		return this.page.getByTestId("filter-cc-min");
	}

	sidebarCcMax(): Locator {
		return this.page.getByTestId("filter-cc-max");
	}

	sidebarYearMin(): Locator {
		return this.page.getByTestId("filter-year-min");
	}

	sidebarYearMax(): Locator {
		return this.page.getByTestId("filter-year-max");
	}

	// ── Filter helpers (mobile drawer) ──

	drawerMakeSelect(): Locator {
		return this.page.getByTestId("drawer-make");
	}

	drawerCcMin(): Locator {
		return this.page.getByTestId("drawer-cc-min");
	}

	drawerCcMax(): Locator {
		return this.page.getByTestId("drawer-cc-max");
	}

	drawerYearMin(): Locator {
		return this.page.getByTestId("drawer-year-min");
	}

	drawerYearMax(): Locator {
		return this.page.getByTestId("drawer-year-max");
	}

	async openDrawer() {
		await this.filterDrawerToggle.click();
		await this.drawerMakeSelect().waitFor();
	}

	async fillAndBlur(locator: Locator, value: string) {
		await locator.fill(value);
		await locator.blur();
		await this.resultCount.waitFor();
	}
}
