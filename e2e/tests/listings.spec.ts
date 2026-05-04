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

// Desktop sidebar filter tests — skipped on mobile where sidebar is hidden
test.describe("Desktop sidebar filters", () => {
	test.beforeEach(({ page: _page }, testInfo) => {
		test.skip(testInfo.project.name === "mobile", "desktop only");
	});

	test("make filter updates URL and filters results", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.sidebarMakeSelect().selectOption("honda-e2e");
		await expect(page).toHaveURL(/make=honda-e2e/);
		await expect(listings.resultCount).toBeVisible();
	});

	test("cc range filter updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.fillAndBlur(listings.sidebarCcMin(), "400");
		await expect(page).toHaveURL(/cc_min=400/);
		await listings.fillAndBlur(listings.sidebarCcMax(), "600");
		await expect(page).toHaveURL(/cc_max=600/);
	});

	test("year range filter updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.fillAndBlur(listings.sidebarYearMin(), "2020");
		await expect(page).toHaveURL(/year_min=2020/);
		await listings.fillAndBlur(listings.sidebarYearMax(), "2024");
		await expect(page).toHaveURL(/year_max=2024/);
	});

	test("cc range that excludes seeded listing shows empty or fewer results", async ({ page }) => {
		const listings = new ListingsPage(page);
		// Seeded listing has 471cc — filter for 50-100cc should exclude it
		await listings.goto({ cc_min: "50", cc_max: "100" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).not.toBeVisible();
	});

	test("year range that includes seeded listing shows it", async ({ page }) => {
		const listings = new ListingsPage(page);
		// Seeded listing is year 2022
		await listings.goto({ year_min: "2020", year_max: "2024" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
	});
});

// Mobile filter drawer tests — only run on mobile project
test.describe("Mobile filter drawer", () => {
	test.beforeEach(({ page: _page }, testInfo) => {
		test.skip(testInfo.project.name !== "mobile", "mobile only");
	});

	test("drawer opens and shows make filter", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await expect(listings.drawerMakeSelect()).toBeVisible();
	});

	test("make filter in drawer updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.drawerMakeSelect().selectOption("honda-e2e");
		await expect(page).toHaveURL(/make=honda-e2e/);
	});

	test("cc range in drawer updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.fillAndBlur(listings.drawerCcMin(), "400");
		await expect(page).toHaveURL(/cc_min=400/);
	});

	test("year range in drawer updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.fillAndBlur(listings.drawerYearMin(), "2020");
		await expect(page).toHaveURL(/year_min=2020/);
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

	test("booking form is visible for authenticated non-owner", async ({
		authenticatedViewerPage,
	}, testInfo) => {
		const detail = new ListingDetailPage(authenticatedViewerPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);

		// On mobile, the booking form is inside a fullscreen modal triggered by a bottom bar button
		if (testInfo.project.name === "mobile") {
			await detail.mobileBookButton.click();
			await expect(detail.bookingDialog).toBeVisible();
			await expect(detail.bookingDialog.getByTestId("booking-section")).toBeVisible();
		} else {
			await expect(detail.bookingSection).toBeVisible();
		}
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
