import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { LIFECYCLE_AUTH_STATE_PATH } from "../global-setup";
import { waitForHydration } from "../helpers";
import { DashboardPage } from "../pages/dashboard.page";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingFormPage } from "../pages/listing-form.page";
import { ListingsPage } from "../pages/listings.page";

const LISTING_TITLE = "E2E Lifecycle Yamaha MT-07 2021";
const LISTING_TITLE_EDITED = "E2E Lifecycle Yamaha MT-07 2021 – muokattu";

test.describe("Listing lifecycle", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	let listingId: string;

	test.beforeAll(async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: LIFECYCLE_AUTH_STATE_PATH });
		page = await ctx.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("create listing and assert detail page", async () => {
		const form = new ListingFormPage(page);
		await form.gotoCreate();
		await form.fill({
			title: LISTING_TITLE,
			make: "Honda",
			year: 2021,
			motorcycleType: "Naked",
			pricePerDay: 45,
			city: "Helsinki",
			region: "Uusimaa",
			description: "E2E lifecycle test listing — luotu automaattisesti e2e-testillä.",
		});
		await form.submitButton.click();
		await page.waitForURL((url) => /\/pyorat\/vuokraus\/[^/]+\/[^/]+$/.test(url.pathname), {
			timeout: 15000,
		});
		await waitForHydration(page);

		const match = page.url().match(/\/pyorat\/vuokraus\/([^/]+)\/[^/]+$/);
		if (!match) {
			throw new Error("Could not extract listing short_id from URL");
		}
		listingId = match[1];

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(LISTING_TITLE);
	});

	test("listing appears in browse results", async () => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "E2E Lifecycle Yamaha" });
		await expect(listings.cardById(listingId)).toBeVisible({ timeout: 10000 });
	});

	test("edit listing updates title", async () => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.listingRow(listingId)).toBeVisible();
		await dashboard.editButton(listingId).click();
		await page.waitForURL(/\/muokkaa/, { timeout: 10000 });
		await waitForHydration(page);

		const form = new ListingFormPage(page);
		await form.titleInput.fill(LISTING_TITLE_EDITED);
		await form.submitButton.click();
		await page.waitForURL(/\/pyorat\/vuokraus\/[^/]+\/[^/]+$/, { timeout: 15000 });
		await waitForHydration(page);

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(LISTING_TITLE_EDITED);
	});

	test("delete listing removes it from dashboard", async () => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.listingRow(listingId)).toBeVisible();

		page.once("dialog", (dialog) => dialog.accept());
		await dashboard.deleteButton(listingId).click();

		await expect(dashboard.listingRow(listingId)).not.toBeVisible({ timeout: 10000 });
	});
});
