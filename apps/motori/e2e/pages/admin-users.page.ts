import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class AdminUsersPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly searchInput: Locator;
	readonly searchButton: Locator;
	readonly rows: Locator;
	readonly emptyState: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole("heading", { name: "Users", exact: true });
		this.searchInput = page.getByPlaceholder("Search by email…");
		this.searchButton = page.getByRole("button", { name: "Search", exact: true });
		this.rows = page.locator("tbody tr");
		this.emptyState = page.getByText("No users found.");
	}

	async goto() {
		await this.page.goto("/admin/users");
		await waitForHydration(this.page);
	}

	async search(term: string) {
		await this.searchInput.fill(term);
		await this.searchButton.click();
		await this.page.waitForURL((url) => url.searchParams.get("search") === term);
	}

	row(email: string): Locator {
		return this.rows.filter({ hasText: email });
	}

	rowStatus(email: string): Locator {
		return this.row(email).locator("td").nth(3);
	}

	banButton(email: string): Locator {
		return this.row(email).getByRole("button", { name: "Ban", exact: true });
	}

	unbanButton(email: string): Locator {
		return this.row(email).getByRole("button", { name: "Unban", exact: true });
	}

	// Both actions go through a window.confirm dialog.
	async ban(email: string) {
		this.page.once("dialog", (dialog) => dialog.accept());
		await this.banButton(email).click();
	}

	async unban(email: string) {
		this.page.once("dialog", (dialog) => dialog.accept());
		await this.unbanButton(email).click();
	}
}
