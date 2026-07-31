import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class AdminListingsPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly statusFilter: Locator;
	readonly searchInput: Locator;
	readonly searchButton: Locator;
	readonly selectAllCheckbox: Locator;
	readonly pauseButton: Locator;
	readonly removeButton: Locator;
	readonly activateButton: Locator;
	readonly rows: Locator;
	readonly emptyState: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole("heading", { name: "Listings", exact: true });
		this.statusFilter = page.getByLabel("Filter by status");
		this.searchInput = page.getByPlaceholder("Search title, brand, model…");
		this.searchButton = page.getByRole("button", { name: "Search", exact: true });
		this.selectAllCheckbox = page.getByLabel("Select all", { exact: true });
		this.pauseButton = page.getByRole("button", { name: "Pause", exact: true });
		this.removeButton = page.getByRole("button", { name: "Remove", exact: true });
		this.activateButton = page.getByRole("button", { name: "Activate", exact: true });
		this.rows = page.locator("tbody tr");
		this.emptyState = page.getByText("No listings found.");
	}

	async goto() {
		await this.page.goto("/admin/listings");
		await waitForHydration(this.page);
	}

	async search(term: string) {
		await this.searchInput.fill(term);
		await this.searchButton.click();
		await this.page.waitForURL((url) => url.searchParams.get("search") === term);
	}

	// Empty string selects "All statuses" (drops the param).
	async filterByStatus(status: "" | "active" | "paused" | "rented" | "removed") {
		await this.statusFilter.selectOption(status);
		await this.page.waitForURL((url) => url.searchParams.get("status") === (status || null));
	}

	row(title: string): Locator {
		return this.rows.filter({ hasText: title });
	}

	rowCheckbox(title: string): Locator {
		return this.page.getByLabel(`Select ${title}`, { exact: true });
	}

	rowStatus(title: string): Locator {
		return this.row(title).locator("td").nth(3);
	}
}
