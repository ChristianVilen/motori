import { test as base, type Page } from "@playwright/test";
import { AUTH_STATE_PATH } from "./global-setup";

export { expect } from "@playwright/test";

// Authenticated fixture: each test gets a fresh context seeded from the global auth
// state. The session cookie was minted by motori (:3000) but is host-only on
// localhost, so it applies to talli (:3001) too — the whole point of the SSO test.
export const test = base.extend<{ authenticatedPage: Page }>({
	authenticatedPage: async ({ browser }, use) => {
		const ctx = await browser.newContext({ storageState: AUTH_STATE_PATH });
		const page = await ctx.newPage();
		await use(page);
		await ctx.close();
	},
});
