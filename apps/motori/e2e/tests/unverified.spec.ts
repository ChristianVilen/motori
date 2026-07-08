import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { BASE_URL, TEST_PASSWORD } from "../global-setup";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";

test.describe("Unverified user flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		// Register via API — user stays unverified (emailVerified=false)
		const email = uniqueEmail();
		const ctx = await browser.newContext();
		const signUp = await ctx.request.post(`${BASE_URL}/api/auth/sign-up/email`, {
			data: { name: uniqueName(), email, password: TEST_PASSWORD },
			headers: { Origin: BASE_URL },
		});
		if (!signUp.ok()) {
			throw new Error(`Unverified setup: sign-up failed: ${await signUp.text()}`);
		}
		const signIn = await ctx.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
			data: { email, password: TEST_PASSWORD },
			headers: { Origin: BASE_URL },
		});
		if (!signIn.ok()) {
			throw new Error(`Unverified setup: sign-in failed: ${await signIn.text()}`);
		}
		page = await ctx.newPage();
	});
	test.afterAll(async () => {
		await page.close();
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
		await page.goto("/pyorat/vuokraus");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/pyorat\/vuokraus/);
	});
});
