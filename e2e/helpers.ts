import type { Page } from "@playwright/test";
import { TEST_PASSWORD } from "./global-setup";
import { LoginPage } from "./pages/login.page";

export function uniqueEmail() {
	return `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

export function uniqueName() {
	return `Test User ${Math.random().toString(36).slice(2)}`;
}

// React hydration marker set by the root component. Without this, clicks/submits
// before hydration fall through to the native browser handler, bypassing router navigation.
export async function waitForHydration(page: Page) {
	await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

export async function loginAs(page: Page, email: string) {
	const login = new LoginPage(page);
	await login.goto();
	await login.login(email, TEST_PASSWORD);
	await page.waitForURL("/");
	await waitForHydration(page);
}

/** Backdate a user's createdAt so the 24h grace period has expired. */
export async function backdateUser(email: string, daysAgo: number) {
	const { db } = await import("../src/lib/db/index");
	const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
	await db.updateTable("user").set({ createdAt: past }).where("email", "=", email).execute();
}
