import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ToriDetailPage {
	readonly page: Page;
	readonly title: Locator;

	constructor(page: Page) {
		this.page = page;
		this.title = page.getByTestId("tori-detail-title");
	}

	async waitForLoad() {
		await this.title.waitFor();
		await waitForHydration(this.page);
	}
}
