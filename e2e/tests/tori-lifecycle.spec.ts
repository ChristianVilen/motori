import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { LIFECYCLE_AUTH_STATE_PATH } from "../global-setup";
import { waitForHydration } from "../helpers";
import { ToriBrowsePage } from "../pages/tori-browse.page";
import { ToriDetailPage } from "../pages/tori-detail.page";
import { ToriFormPage } from "../pages/tori-form.page";

const ITEM_TITLE = "E2E Tori Alpinestars GP Plus koko 52";
const ITEM_TITLE_EDITED = "E2E Tori Alpinestars GP Plus koko 52 – muokattu";

test.describe("Tori item lifecycle", () => {
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

	test("create tori item and assert detail page", async () => {
		const form = new ToriFormPage(page);
		await form.gotoCreate();
		await form.fill({
			title: ITEM_TITLE,
			category: "gear",
			condition: "excellent",
			price: 280,
			city: "Helsinki",
			description: "E2E lifecycle test — luotu automaattisesti.",
		});
		await form.submitButton.click();
		await page.waitForURL(
			(url) => /\/tori\/[^/]+\/[^/]+$/.test(url.pathname) && url.pathname !== "/tori/uusi",
			{ timeout: 15000 },
		);
		await waitForHydration(page);

		const match = page.url().match(/\/tori\/([^/]+)\/[^/]+$/);
		if (!match) {
			throw new Error("Could not extract item short_id from URL");
		}
		itemId = match[1];

		const detail = new ToriDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE);
	});

	test("item appears in tori browse", async () => {
		const browse = new ToriBrowsePage(page);
		await browse.goto({ q: "E2E Tori Alpinestars" });
		await expect(browse.cardById(itemId)).toBeVisible({ timeout: 10000 });
	});

	test("edit item updates title", async () => {
		await page.goto(`/tori/${itemId}/muokkaa`);
		await waitForHydration(page);

		const form = new ToriFormPage(page);
		await form.titleInput.fill(ITEM_TITLE_EDITED);
		await form.submitButton.click();
		await page.waitForURL(/\/tori\/[^/]+\/[^/]+$/, { timeout: 15000 });
		await waitForHydration(page);

		const detail = new ToriDetailPage(page);
		await expect(detail.title).toHaveText(ITEM_TITLE_EDITED);
	});

	test("mark item as sold from dashboard", async () => {
		await page.goto("/omat");
		await waitForHydration(page);

		const row = page.locator(`[data-testid="tori-item-row"][data-item-id="${itemId}"]`);
		await row.getByTestId("tori-item-mark-sold").click();

		// Verify status changes to sold
		await expect(row.getByTestId("tori-item-status")).toHaveText("Myyty", { timeout: 10000 });
	});
});
