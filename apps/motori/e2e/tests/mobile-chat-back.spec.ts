import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG } from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { MessagesPage } from "../pages/messages.page";

test.describe("mobile chat navigation", () => {
	test.use({ isMobile: true });

	test("back button from chat screen shows inbox instead of white screen", async ({
		authenticatedViewerPage: page,
	}) => {
		const listing = new ListingDetailPage(page);
		const messages = new MessagesPage(page);

		await listing.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await listing.messageSellerButton.click();
		await messages.waitForThread();

		await messages.backLink.click();

		await expect(page).toHaveURL(/\/viestit(\?.*)?$/);
		await expect(messages.inboxTitle).toBeVisible();
	});
});
