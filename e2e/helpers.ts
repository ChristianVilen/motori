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
}
