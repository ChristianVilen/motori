import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { LIFECYCLE_AUTH_STATE_PATH } from "../global-setup";
import { waitForHydration } from "../helpers";
import { ListingDetailPage } from "../pages/listing-detail.page";

const ITEM_TITLE = "E2E Gear Alpinestars GP Plus koko 52";
const ITEM_TITLE_EDITED = "E2E Gear Alpinestars GP Plus koko 52 – muokattu";

test.describe("Gear listing lifecycle", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	let itemId: string;

	test.beforeAll(async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: LIFECYCLE_AUTH_STATE_PATH });
		page = await ctx.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("create gear listing and assert detail page", async () => {
		await page.goto("/ilmoitukset/uusi");
		await waitForHydration(page);

		await page.getByTestId("category-tile-gear").click();
		await page.locator("#title").fill(ITEM_TITLE);

		// Gear-specific fields use Radix Select (no native <select>)
		await page.getByText("Valitse tyyppi").click();
		await page.getByRole("option", { name: "Takki", exact: true }).click();

		await page.locator("#gear_size").fill("52");

		await page.getByText("Valitse kunto").click();
		await page.getByRole("option", { name: "Erinomainen", exact: true }).click();

		await page.locator("#gear_price").fill("280");

		await page.locator("#city").fill("Helsinki");
		await page.getByRole("option", { name: "Helsinki", exact: true }).first().click();

		await page
			.locator("#description")
			.fill("E2E lifecycle test — luotu automaattisesti automaation kautta.");

		await page.getByTestId("listing-form-submit").click();
		await page.waitForURL(
			(url) => /\/varusteet\/[^/]+\/[^/]+$/.test(url.pathname),
			{ timeout: 15000 },
		);
		await waitForHydration(page);

		const match = page.url().match(/\/varusteet\/([^/]+)\/[^/]+$/);
		if (!match) {
			throw new Error("Could not extract listing short_id from URL");
		}
		itemId = match[1];

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE);
	});

	test("gear listing appears in /varusteet browse", async () => {
		await page.goto("/varusteet?q=E2E+Gear+Alpinestars");
		await waitForHydration(page);
		await expect(
			page.locator(`[data-testid="listing-card"][data-listing-id="${itemId}"]`),
		).toBeVisible({ timeout: 10000 });
	});

	test("edit gear listing updates title", async () => {
		await page.goto("/omat");
		await waitForHydration(page);

		const row = page.locator(`[data-testid="dashboard-listing-row"][data-listing-id="${itemId}"]`);
		await row.getByTestId("dashboard-listing-edit").click();
		await page.waitForURL(/\/muokkaa/, { timeout: 10000 });
		await waitForHydration(page);

		await page.locator("#title").fill(ITEM_TITLE_EDITED);
		await page.getByTestId("listing-form-submit").click();
		await page.waitForURL(/\/varusteet\/[^/]+\/[^/]+$/, { timeout: 15000 });
		await waitForHydration(page);

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE_EDITED);
	});
});
