import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingsPage {
	readonly page: Page;
	readonly searchInput: Locator;
	readonly searchControl: Locator;
	readonly mobileTrigger: Locator;
	readonly dialogSearch: Locator;
	readonly leafMap: Locator;
	readonly drawer: Locator;
	readonly resultCount: Locator;
	readonly totalCount: Locator;
	readonly regionLabel: Locator;
	readonly grid: Locator;
	readonly cards: Locator;
	readonly loadMoreButton: Locator;
	readonly emptyState: Locator;
	readonly filterDrawerToggle: Locator;
	readonly viewToggle: Locator;
	readonly mapCityPanel: Locator;
	readonly mapCityPanelClose: Locator;

	constructor(page: Page) {
		this.page = page;
		this.searchInput = page.getByTestId("site-search-input");
		this.mobileTrigger = page.getByTestId("site-search-trigger");
		this.searchControl = this.searchInput.or(this.mobileTrigger).filter({ visible: true });
		this.dialogSearch = page.getByRole("dialog").getByRole("searchbox");
		this.leafMap = page.locator(".leaflet-container");
		this.drawer = page.getByRole("dialog", { name: "Suodattimet" });
		this.resultCount = page.getByTestId("listings-result-count");
		this.totalCount = page.getByTestId("listings-total-count");
		this.regionLabel = page.getByTestId("listings-region-label");
		this.grid = page.getByTestId("listings-grid");
		this.cards = page.getByTestId("listing-card");
		this.loadMoreButton = page.getByTestId("listings-load-more");
		this.emptyState = page.getByTestId("listings-empty-state");
		this.filterDrawerToggle = page.getByTestId("listings-filter-drawer-toggle");
		this.viewToggle = page.getByTestId("listings-view-toggle");
		this.mapCityPanel = page.getByTestId("map-city-panel");
		this.mapCityPanelClose = page.getByTestId("map-city-panel-close");
	}

	async goto(params?: Record<string, string>) {
		const query = params ? `?${new URLSearchParams(params).toString()}` : "";
		await this.page.goto(`/pyorat/vuokraus${query}`);
		await this.resultCount.waitFor();
		await waitForHydration(this.page);
	}

	async search(query: string) {
		const mobile = await this.mobileTrigger.isVisible();
		if (mobile) {
			await this.mobileTrigger.click();
		}
		const input = mobile ? this.dialogSearch : this.searchInput;
		await input.fill(query);
		await input.press("Enter");
	}

	async gotoGear(params?: Record<string, string>) {
		const query = params ? `?${new URLSearchParams(params).toString()}` : "";
		await this.page.goto(`/varusteet${query}`);
		await waitForHydration(this.page);
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

	categoryChip(name: string) {
		return this.page.getByTestId(`browse-category-chip-${name}`);
	}
	cityMarker(city: string) {
		return this.leafMap.getByTitle(city, { exact: true });
	}

	drawerMakeSelect(): Locator {
		return this.page.getByTestId("filter-make");
	}

	drawerCcMin(): Locator {
		return this.page.getByTestId("filter-cc-min");
	}

	drawerCcMax(): Locator {
		return this.page.getByTestId("filter-cc-max");
	}

	drawerYearMin(): Locator {
		return this.page.getByTestId("filter-year-min");
	}

	drawerYearMax(): Locator {
		return this.page.getByTestId("filter-year-max");
	}

	async openDrawer() {
		await this.filterDrawerToggle.click();
		await this.drawer.waitFor();
	}

	async fillAndBlur(locator: Locator, value: string) {
		await locator.fill(value);
		await locator.blur();
		await this.resultCount.waitFor();
	}
}
