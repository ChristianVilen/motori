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

// 1x1 PNG, verified decodable by sharp — the upload endpoint processes it for real.
// Kept as base64 so no binary fixture lives in the repo.
const TEST_PNG_BASE64 =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Listings require at least one image since #175; create flows attach this.
export async function attachTestImage(page: Page) {
	await page.getByTestId("listing-image-input").setInputFiles({
		name: "test-image.png",
		mimeType: "image/png",
		buffer: Buffer.from(TEST_PNG_BASE64, "base64"),
	});
	// The preview thumbnail renders via FileReader (async) — wait for it before submitting.
	await page.locator('img[src^="data:"]').first().waitFor();
}

export async function loginAs(page: Page, email: string) {
	const login = new LoginPage(page);
	await login.goto();
	await login.login(email, TEST_PASSWORD);
	await page.waitForURL((url) => url.pathname !== "/kirjaudu");
	await waitForHydration(page);
}
