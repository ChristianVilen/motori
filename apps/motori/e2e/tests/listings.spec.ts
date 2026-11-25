import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, SEEDED_LISTING_TITLE } from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingsPage } from "../pages/listings.page";

test.describe("Listings browse", () => {
	test("renders search bar and result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await expect(listings.searchControl).toBeVisible();
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

	test("category chip keeps the query when switching from gear to rentals", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.gotoGear({ q: "x" });
		await listings.categoryChip("rental").click();
		await expect(page).toHaveURL("/pyorat/vuokraus?q=x");
	});

	test("empty search shows empty state", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "xyznonexistentmotorcycle12345" });
		await expect(listings.emptyState).toBeVisible();
	});

	test("logged-out heart tap prompts sign-in", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "CB500F" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
		await seeded.getByTestId("favorite-button").click();
		await expect(page.getByTestId("login-modal")).toBeVisible();
	});

	test("seeded listing is visible and links to detail page", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "CB500F" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
		await expect(seeded).toContainText(SEEDED_LISTING_TITLE);
		await seeded.click();
		await expect(page).toHaveURL(
			new RegExp(`/pyorat/vuokraus/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}$`),
		);
	});
});

test.describe("Desktop filter panel", () => {
	test.beforeEach(({ page: _page }, testInfo) => {
		test.skip(testInfo.project.name === "mobile", "desktop only");
	});

	test("make filter updates URL and filters results", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.drawerMakeSelect().selectOption("honda-e2e");
		await expect(page).toHaveURL(/make=honda-e2e/);
		await expect(listings.resultCount).toBeVisible();
	});

	test("cc range filter updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.fillAndBlur(listings.drawerCcMin(), "400");
		await expect(page).toHaveURL(/cc_min=400/);
		await listings.fillAndBlur(listings.drawerCcMax(), "600");
		await expect(page).toHaveURL(/cc_max=600/);
	});

	test("year range filter updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.openDrawer();
		await listings.fillAndBlur(listings.drawerYearMin(), "2020");
		await expect(page).toHaveURL(/year_min=2020/);
		await listings.fillAndBlur(listings.drawerYearMax(), "2024");
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
		await expect(detail.pricePerDay).toContainText("55 €");
		await expect(detail.locationInfo).toContainText("Helsinki");
	});

	test("booking form is visible for authenticated non-owner", async ({
		authenticatedViewerPage,
	}, testInfo) => {
		const detail = new ListingDetailPage(authenticatedViewerPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);

		await expect(detail.bookingSection).toBeVisible();
		if (testInfo.project.name === "mobile") {
			await detail.selectFirstTwoDays();
			await detail.mobileBookButton.click();
			await expect(detail.bookingDialog).toBeVisible();
			await expect(detail.message).toBeVisible();
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

test.describe("Map view", () => {
	test("view toggle switches to map view and updates URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.viewToggle.click();
		await expect(page).toHaveURL(/view=map/);
		// Map container should be visible (leaflet creates .leaflet-container)
		await expect(listings.leafMap).toBeVisible();
	});

	test("view toggle switches back to list view", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ view: "map" });
		await expect(listings.leafMap).toBeVisible();
		await listings.viewToggle.click();
		await expect(page).not.toHaveURL(/view=map/);
		await expect(listings.grid).toBeVisible();
	});

	test("selecting a city pin opens the city panel", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ view: "map" });
		await listings.cityMarker("Helsinki").click();
		await expect(page).toHaveURL(/city=Helsinki/);
		await expect(listings.mapCityPanel).toBeVisible();
		await expect(listings.mapCityPanel).toContainText("Helsinki");
		// City panel should contain listing cards
		await expect(listings.mapCityPanel.getByTestId("listing-card").first()).toBeVisible();
	});

	test("closing city panel removes city from URL", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ view: "map", city: "Helsinki" });
		await expect(listings.mapCityPanel).toBeVisible();
		await listings.mapCityPanelClose.click();
		await expect(page).not.toHaveURL(/city=Helsinki/);
		await expect(listings.mapCityPanel).not.toBeVisible();
	});

	test("back navigation preserves map view with city selection", async ({ page }) => {
		const listings = new ListingsPage(page);
		// 1. Navigate to map view with Helsinki selected, waiting for full hydration
		await listings.goto({ view: "map", city: "Helsinki" });
		await expect(listings.mapCityPanel).toBeVisible();
		// 2. Click a listing card to go to detail page
		const firstCard = listings.mapCityPanel.getByTestId("listing-card").first();
		await firstCard.scrollIntoViewIfNeeded();
		await firstCard.click();
		await page.waitForURL(/\/pyorat\/vuokraus\/.+\/.+/);
		// 3. Go back — should return to map view with Helsinki selected
		await page.goBack();
		await expect(page).toHaveURL(/view=map/);
		await expect(page).toHaveURL(/city=Helsinki/);
		await expect(listings.mapCityPanel).toBeVisible();
		await expect(listings.mapCityPanel).toContainText("Helsinki");
	});

	test("back from map view returns to list view", async ({ page }) => {
		const listings = new ListingsPage(page);
		// 1. Start on list view
		await listings.goto();
		await expect(listings.grid).toBeVisible();
		// 2. Switch to map
		await listings.viewToggle.click();
		await expect(page).toHaveURL(/view=map/);
		// 3. Go back — should return to list view
		await page.goBack();
		await expect(page).not.toHaveURL(/view=map/);
		await expect(listings.grid).toBeVisible();
	});
});
