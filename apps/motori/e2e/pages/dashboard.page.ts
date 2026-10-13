import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class DashboardPage {
	readonly page: Page;
	readonly newListingButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.newListingButton = page.getByTestId("dashboard-new-listing");
	}

	async goto() {
		await this.page.goto("/omat");
		await waitForHydration(this.page);
	}

	listingRow(listingId: string): Locator {
		return this.page.locator(
			`[data-testid="dashboard-listing-row"][data-listing-id="${listingId}"]`,
		);
	}

	async openEdit(listingId: string) {
		await this.listingRow(listingId).getByTestId("dashboard-listing-edit").click();
		await this.page.waitForURL(/\/muokkaa/, { timeout: 10000 });
		await waitForHydration(this.page);
	}

	deleteButton(listingId: string): Locator {
		return this.listingRow(listingId).locator('[data-testid="dashboard-listing-delete"]');
	}
}
