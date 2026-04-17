import { test as base, type Page } from "@playwright/test";
import { AUTH_STATE_PATH } from "./global-setup";

export { expect } from "@playwright/test";

// Authenticated fixture: each test gets a fresh context seeded from the global auth state.
// Safe for fullyParallel — contexts are isolated, storageState is read-only.
export const test = base.extend<{
	authenticatedPage: Page;
}>({
	authenticatedPage: async ({ browser }, use) => {
		const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
		const page = await ctx.newPage();
		await use(page);
		await ctx.close();
	},
});
