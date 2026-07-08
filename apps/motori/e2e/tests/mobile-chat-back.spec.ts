import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG } from "../global-setup";
import { waitForHydration } from "../helpers";

const LISTING_URL = `/pyorat/vuokraus/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}`;

test.describe("mobile chat navigation", () => {
	// Only run this on mobile
	test.use({ isMobile: true });

	test("back button from chat screen shows inbox instead of white screen", async ({
		authenticatedViewerPage,
	}) => {
		// Go to listing
		await authenticatedViewerPage.goto(LISTING_URL);
		await waitForHydration(authenticatedViewerPage);

		// Click "Lähetä viesti"
		await authenticatedViewerPage.getByRole("button", { name: /lähetä viesti/i }).click();

		// Wait for chat screen to load
		await authenticatedViewerPage.waitForURL(/\/viestit\/.+/);
		await waitForHydration(authenticatedViewerPage);

		// Ensure we are in thread view (mobile)
		const backBtn = authenticatedViewerPage.getByRole("link", { name: "Takaisin" });
		await expect(backBtn).toBeVisible();

		// Click the back button
		await backBtn.click();

		// Wait for URL to be the inbox index
		await authenticatedViewerPage.waitForURL(/\/viestit(\?.*)?$/);

		// Confirm the inbox list is visible after navigating back from a thread
		const inboxTitle = authenticatedViewerPage.getByRole("heading", {
			name: "Viestit",
			exact: true,
		});
		await expect(inboxTitle).toBeVisible();
	});
});
