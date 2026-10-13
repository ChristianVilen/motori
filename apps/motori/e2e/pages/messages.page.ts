import { expect, type Locator, type Page } from "@playwright/test";

export class MessagesPage {
	readonly page: Page;
	readonly inboxTitle: Locator;
	readonly thread: Locator;
	readonly backLink: Locator;

	constructor(page: Page) {
		this.page = page;
		this.inboxTitle = page.getByRole("heading", { name: "Viestit", exact: true });
		this.thread = page.getByRole("log", { name: "Keskustelu" });
		this.backLink = page.getByRole("link", { name: "Takaisin", exact: true });
	}

	// The router changes the URL before the thread renders. Until then the previous page,
	// which can have its own "Takaisin" link, is still on screen.
	async waitForThread() {
		await this.page.waitForURL(/\/viestit\/.+/);
		await expect(this.thread).toBeVisible();
	}
}
