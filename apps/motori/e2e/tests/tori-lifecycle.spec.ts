import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { LIFECYCLE_AUTH_STATE_PATH } from "../global-setup";
import { DashboardPage } from "../pages/dashboard.page";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingFormPage } from "../pages/listing-form.page";
import { ListingsPage } from "../pages/listings.page";

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
		await page.context().close();
	});

	test("create gear listing and assert detail page", async () => {
		const form = new ListingFormPage(page);
		await form.gotoCreate();
		await form.fillGear({
			title: ITEM_TITLE,
			type: "Takki",
			size: "L",
			condition: "Erinomainen",
			price: 280,
			city: "Helsinki",
			description: "E2E lifecycle test — luotu automaattisesti automaation kautta.",
		});
		await form.submitGear();

		const match = page.url().match(/\/varusteet\/([^/]+)\/[^/]+$/);
		if (!match) {
			throw new Error("Could not extract listing short_id from URL");
		}
		itemId = match[1];

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE);
	});

	test("gear listing appears in /varusteet browse", async () => {
		const listings = new ListingsPage(page);
		await listings.gotoGear({ q: "E2E Gear Alpinestars" });
		await expect(listings.cardById(itemId)).toBeVisible({ timeout: 10000 });
	});

	test("edit gear listing updates title", async () => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await dashboard.openEdit(itemId);
		const form = new ListingFormPage(page);
		await form.titleInput.fill(ITEM_TITLE_EDITED);
		await form.submitGear();

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE_EDITED);
	});
});
