import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../global-setup";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { RegisterPage } from "../pages/register.page";

test.describe("Unverified user flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("register creates an unverified account", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, TEST_PASSWORD);
		await page.waitForURL(/\/taydenna-profiili/, { timeout: 10000 });
		await waitForHydration(page);
	});

	test("nav add-listing link is disabled for unverified user", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const navAddListing = page.getByTestId("nav-add-listing");
		await expect(navAddListing).toBeVisible();
		const tag = await navAddListing.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("home page CTA is disabled for unverified user", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const cta = page.getByTestId("home-add-listing-cta");
		await expect(cta).toBeVisible();
		const tag = await cta.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("dashboard new-listing button is disabled", async () => {
		await page.goto("/omat");
		await waitForHydration(page);
		const btn = page.getByTestId("dashboard-new-listing");
		await expect(btn).toBeVisible();
		await expect(btn).toBeDisabled();
	});

	test("direct navigation to /ilmoitukset/uusi is blocked", async () => {
		await page.goto("/ilmoitukset/uusi");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/ilmoitukset\/uusi/);
	});

	test("verification banner shows check-spam prompt then resend button", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const banner = page.locator("text=Vahvista sähköpostiosoitteesi");
		await expect(banner).toBeVisible();
		const resendButton = page.locator("text=Lähetä uudelleen");
		await expect(resendButton).not.toBeVisible();
		const checkSpam = page.locator("text=Tarkista roskaposti");
		await expect(checkSpam).toBeVisible();
		await checkSpam.click();
		await expect(resendButton).toBeVisible();
	});

	test("unverified user can still browse listings", async () => {
		await page.goto("/ilmoitukset");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/ilmoitukset/);
	});
});
