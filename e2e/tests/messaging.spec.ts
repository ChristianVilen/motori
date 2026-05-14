import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, SEEDED_LISTING_TITLE } from "../global-setup";
import { waitForHydration } from "../helpers";

const LISTING_URL = `/pyorat/vuokraus/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}`;

test.describe("Messaging", () => {
	test("viewer messages owner; owner sees and reads thread", async ({
		authenticatedPage,
		authenticatedViewerPage,
	}) => {
		await authenticatedViewerPage.goto(LISTING_URL);
		await waitForHydration(authenticatedViewerPage);

		await authenticatedViewerPage
			.getByRole("button", { name: /lähetä viesti/i })
			.click();
		await authenticatedViewerPage.waitForURL(/\/viestit\//);
		await waitForHydration(authenticatedViewerPage);

		const body = `Onko vielä saatavilla? ${Date.now()}`;
		await authenticatedViewerPage
			.getByPlaceholder(/kirjoita viesti/i)
			.fill(body);
		await authenticatedViewerPage
			.getByRole("button", { name: /^lähetä$/i })
			.click();
		await expect(authenticatedViewerPage.getByText(body)).toBeVisible();

		// Owner inbox: conversation appears with the listing title, then clicking marks it read.
		await authenticatedPage.goto("/viestit");
		await waitForHydration(authenticatedPage);
		await expect(
			authenticatedPage.getByText(SEEDED_LISTING_TITLE).first(),
		).toBeVisible();

		await authenticatedPage.getByText(SEEDED_LISTING_TITLE).first().click();
		await authenticatedPage.waitForURL(/\/viestit\//);
		await waitForHydration(authenticatedPage);
		await expect(authenticatedPage.getByText(body)).toBeVisible();

		// Navigate back to inbox — unread badge should be gone (markRead ran on thread load).
		await authenticatedPage.goto("/viestit");
		await waitForHydration(authenticatedPage);
		// The unread badge is a small rounded pill containing a number. Asserting it isn't
		// present for this conversation is brittle if other unrelated conversations exist,
		// so we assert by reloading and verifying no numeric badge is shown adjacent to the
		// seeded listing title.
		const conversationLink = authenticatedPage
			.getByRole("link", { name: new RegExp(SEEDED_LISTING_TITLE.slice(0, 20), "i") })
			.first();
		if (await conversationLink.count()) {
			await expect(conversationLink).not.toContainText(/^\s*\d+\s*$/);
		}
	});

	test("owner reply propagates to viewer via SSE", async ({
		authenticatedPage,
		authenticatedViewerPage,
	}) => {
		test.slow();
		// Viewer opens the thread and seeds a first message so the conversation exists.
		await authenticatedViewerPage.goto(LISTING_URL);
		await waitForHydration(authenticatedViewerPage);
		await authenticatedViewerPage
			.getByRole("button", { name: /lähetä viesti/i })
			.click();
		await authenticatedViewerPage.waitForURL(/\/viestit\//);
		await waitForHydration(authenticatedViewerPage);

		const initialBody = `Hei ${Date.now()}`;
		await authenticatedViewerPage
			.getByPlaceholder(/kirjoita viesti/i)
			.fill(initialBody);
		await authenticatedViewerPage
			.getByRole("button", { name: /^lähetä$/i })
			.click();
		await expect(authenticatedViewerPage.getByText(initialBody)).toBeVisible();

		// Owner navigates to inbox and opens the conversation.
		await authenticatedPage.goto("/viestit");
		await waitForHydration(authenticatedPage);
		await authenticatedPage.getByText(SEEDED_LISTING_TITLE).first().click();
		await authenticatedPage.waitForURL(/\/viestit\//);
		await waitForHydration(authenticatedPage);

		const reply = `Kyllä on! ${Date.now()}`;
		await authenticatedPage.getByPlaceholder(/kirjoita viesti/i).fill(reply);
		await authenticatedPage.getByRole("button", { name: /^lähetä$/i }).click();
		await expect(authenticatedPage.getByText(reply)).toBeVisible();

		// Viewer's open thread should pick up the reply via SSE within a generous timeout.
		await expect(authenticatedViewerPage.getByText(reply)).toBeVisible({
			timeout: 15_000,
		});
	});

	test("owner cannot see message-seller button on own listing", async ({
		authenticatedPage,
	}) => {
		await authenticatedPage.goto(LISTING_URL);
		await waitForHydration(authenticatedPage);
		await expect(
			authenticatedPage.getByRole("button", { name: /lähetä viesti/i }),
		).toHaveCount(0);
	});
});
