import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, SEEDED_LISTING_TITLE } from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingsPage } from "../pages/listings.page";

test.describe("Listings browse", () => {
	test("renders search bar and result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await expect(listings.searchInput).toBeVisible();
		await expect(listings.searchSubmit).toBeVisible();
		await expect(listings.resultCount).toBeVisible();
	});

	test("search updates URL with query", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.search("Honda");
		await expect(page).toHaveURL(/q=Honda/);
		await expect(listings.resultCount).toBeVisible();
	});

	test("region URL param shows region label in result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ region: "uusimaa" });
		await expect(listings.regionLabel).toHaveText("Uusimaa");
	});

	test("empty search shows empty state", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "xyznonexistentmotorcycle12345" });
		await expect(listings.emptyState).toBeVisible();
	});

	test("seeded listing is visible and links to detail page", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "CB500F" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
		await expect(seeded).toContainText(SEEDED_LISTING_TITLE);
		await seeded.click();
		await expect(page).toHaveURL(
			new RegExp(`/ilmoitukset/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}$`),
		);
	});
});

test.describe("Listing detail", () => {
	test("renders seeded listing details", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await expect(detail.title).toHaveText(SEEDED_LISTING_TITLE);
		await expect(detail.priceInfo).toBeVisible();
		await expect(detail.pricePerDay).toContainText("55,00 €");
		await expect(detail.locationInfo).toContainText("Helsinki");
	});

	test("booking form is visible for authenticated non-owner", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await expect(detail.bookingSection).toBeVisible();
	});

	test("shows 404 for nonexistent listing", async ({ page }) => {
		const detail = new ListingDetailPage(page);
		await detail.goto("notexist1", "some-slug");
		await expect(detail.notFound).toBeVisible();
	});
});

test.describe("Listing detail (unauthenticated)", () => {
	test("new listing page redirects unauthenticated users to login", async ({ page }) => {
		await page.goto("/ilmoitukset/uusi");
		await expect(page).toHaveURL(/\/kirjaudu/);
	});
});
