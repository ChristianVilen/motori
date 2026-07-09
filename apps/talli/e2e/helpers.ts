import type { Page } from "@playwright/test";

// React hydration marker set by the root component — same contract as motori.
// Clicks before hydration fall through to native handlers and bypass the router.
export async function waitForHydration(page: Page) {
	await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}
