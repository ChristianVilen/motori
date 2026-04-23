import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../global-setup";
import { loginAs, uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { RegisterPage } from "../pages/register.page";

test.describe("Unverified user restrictions", () => {
	let email: string;

	test.beforeAll(async ({ browser }) => {
		email = uniqueEmail();
		// Register once across all tests in this describe
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, TEST_PASSWORD);
		await page.waitForURL((url) => url.pathname !== "/rekisteroidy");
		await ctx.close();
	});

	test("nav 'add listing' link is disabled for unverified user", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/");
		await waitForHydration(page);

		// Wait for session to load — nav-dashboard only appears when logged in
		await page.getByTestId("nav-dashboard").waitFor();

		const navAddListing = page.getByTestId("nav-add-listing");
		await expect(navAddListing).toBeVisible();
		const tag = await navAddListing.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("home page CTA is disabled for unverified user", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();

		const cta = page.getByTestId("home-add-listing-cta");
		await expect(cta).toBeVisible();
		const tag = await cta.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("dashboard 'new listing' button is disabled", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/omat");
		await waitForHydration(page);

		const btn = page.getByTestId("dashboard-new-listing");
		await expect(btn).toBeVisible();
		await expect(btn).toBeDisabled();
	});

	test("direct navigation to /ilmoitukset/uusi shows error on submit", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/ilmoitukset/uusi");
		await waitForHydration(page);

		// Page loads (login wall allows it), but the server middleware blocks submission
		await expect(page).toHaveURL(/\/ilmoitukset\/uusi/);
	});

	test("verification banner shows check-spam prompt then resend button", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();

		const banner = page.locator("text=Vahvista sähköpostiosoitteesi");
		await expect(banner).toBeVisible();

		// Resend not visible yet — must confirm spam check first
		const resendButton = page.locator("text=Lähetä uudelleen");
		await expect(resendButton).not.toBeVisible();

		// Step 1: click check-spam prompt
		const checkSpam = page.locator("text=Tarkista roskaposti");
		await expect(checkSpam).toBeVisible();
		await checkSpam.click();

		// Step 2: resend button appears
		await expect(resendButton).toBeVisible();
	});

	test("unverified user can still browse listings", async ({ page }) => {
		await loginAs(page, email);
		await page.goto("/ilmoitukset");
		await waitForHydration(page);

		await expect(page).toHaveURL(/\/ilmoitukset/);
	});
});
