import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class AdminStatsPage {
	readonly page: Page;
	readonly heading: Locator;
	readonly periodSelect: Locator;

	constructor(page: Page) {
		this.page = page;
		this.heading = page.getByRole("heading", { name: "Overview" });
		this.periodSelect = page.getByLabel("Signups time period");
	}

	async goto() {
		await this.page.goto("/admin");
		await waitForHydration(this.page);
	}

	statCard(label: string): Locator {
		return this.page.locator(`[data-testid="admin-stat-card"][data-label="${label}"]`);
	}

	statValue(label: string): Locator {
		return this.statCard(label).getByTestId("admin-stat-value");
	}

	async selectPeriod(period: "24h" | "7d" | "30d") {
		await this.periodSelect.selectOption(period);
		await this.page.waitForURL((url) => url.searchParams.get("period") === period);
	}
}
