import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ToriBrowsePage {
	readonly page: Page;
	readonly cards: Locator;

	constructor(page: Page) {
		this.page = page;
		this.cards = page.getByTestId("tori-item-card");
	}

	async goto(params?: Record<string, string>) {
		const query = params ? `?${new URLSearchParams(params).toString()}` : "";
		await this.page.goto(`/tori${query}`);
		await waitForHydration(this.page);
	}

	cardById(id: string): Locator {
		return this.page.locator(`[data-testid="tori-item-card"][data-item-id="${id}"]`);
	}
}
