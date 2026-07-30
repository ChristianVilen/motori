import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
	ADMIN_AUTH_STATE_PATH,
	ADMIN_LISTING_ALPHA_TITLE,
	ADMIN_LISTING_BETA_TITLE,
	ADMIN_LISTING_SEARCH,
	BANNED_EMAIL,
	TEST_PASSWORD,
	VIEWER_EMAIL,
} from "../global-setup";
import { loginAs } from "../helpers";
import { AdminListingsPage } from "../pages/admin-listings.page";
import { AdminStatsPage } from "../pages/admin-stats.page";
import { AdminUsersPage } from "../pages/admin-users.page";
import { LoginPage } from "../pages/login.page";

test.describe("Admin auth guard", () => {
	test("unauthenticated user is redirected away from /admin", async ({ page }) => {
		await page.goto("/admin");
		await expect(page).toHaveURL("/");
	});

	test("non-admin user is redirected away from /admin", async ({
		authenticatedViewerPage: page,
	}) => {
		await page.goto("/admin");
		await expect(page).toHaveURL("/");
		await expect(new AdminStatsPage(page).heading).not.toBeVisible();
	});

	test("non-admin user is redirected away from /admin/users", async ({
		authenticatedViewerPage: page,
	}) => {
		await page.goto("/admin/users");
		await expect(page).toHaveURL("/");
	});
});

test.describe("Admin stats", () => {
	test("admin sees stat cards on /admin", async ({ adminPage: page }) => {
		const stats = new AdminStatsPage(page);
		await stats.goto();
		await expect(stats.heading).toBeVisible();
		for (const label of ["Total users", "Total listings", "New signups", "Active listings"]) {
			await expect(stats.statCard(label)).toBeVisible();
		}
		await expect(stats.statValue("Total users")).toHaveText(/^\d+$/);
		await expect(stats.statValue("Total listings")).toHaveText(/^\d+$/);
	});

	test("signup period selector updates the URL", async ({ adminPage: page }) => {
		const stats = new AdminStatsPage(page);
		await stats.goto();
		await stats.selectPeriod("24h");
		await expect(stats.statValue("New signups")).toHaveText(/^\d+$/);
	});
});

test.describe("Admin listings management", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	let listings: AdminListingsPage;

	// Serial groups share one page across tests, so the per-test adminPage fixture
	// doesn't apply — build the admin context manually from the saved auth state.
	test.beforeAll(async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: ADMIN_AUTH_STATE_PATH });
		page = await ctx.newPage();
		listings = new AdminListingsPage(page);
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("search by title finds the seeded admin listings", async () => {
		await listings.goto();
		await expect(listings.heading).toBeVisible();
		await listings.search(ADMIN_LISTING_SEARCH);
		await expect(listings.row(ADMIN_LISTING_ALPHA_TITLE)).toBeVisible();
		await expect(listings.row(ADMIN_LISTING_BETA_TITLE)).toBeVisible();
		await expect(listings.rows).toHaveCount(2);
	});

	test("bulk pause updates listing statuses", async () => {
		await listings.selectAllCheckbox.check();
		await listings.pauseButton.click();
		await expect(listings.rowStatus(ADMIN_LISTING_ALPHA_TITLE)).toHaveText("paused");
		await expect(listings.rowStatus(ADMIN_LISTING_BETA_TITLE)).toHaveText("paused");
	});

	test("status filter narrows results", async () => {
		await listings.filterByStatus("paused");
		await expect(listings.row(ADMIN_LISTING_ALPHA_TITLE)).toBeVisible();
		await expect(listings.row(ADMIN_LISTING_BETA_TITLE)).toBeVisible();

		await listings.filterByStatus("active");
		await expect(listings.emptyState).toBeVisible();

		await listings.filterByStatus("");
		await expect(listings.rows).toHaveCount(2);
	});

	test("bulk remove, then bulk activate restores the listings", async () => {
		await listings.selectAllCheckbox.check();
		await listings.removeButton.click();
		await expect(listings.rowStatus(ADMIN_LISTING_ALPHA_TITLE)).toHaveText("removed");
		await expect(listings.rowStatus(ADMIN_LISTING_BETA_TITLE)).toHaveText("removed");

		await listings.selectAllCheckbox.check();
		await listings.activateButton.click();
		await expect(listings.rowStatus(ADMIN_LISTING_ALPHA_TITLE)).toHaveText("active");
		await expect(listings.rowStatus(ADMIN_LISTING_BETA_TITLE)).toHaveText("active");
	});

	test("selecting a single listing only updates that one", async () => {
		await listings.rowCheckbox(ADMIN_LISTING_ALPHA_TITLE).check();
		await listings.pauseButton.click();
		await expect(listings.rowStatus(ADMIN_LISTING_ALPHA_TITLE)).toHaveText("paused");
		await expect(listings.rowStatus(ADMIN_LISTING_BETA_TITLE)).toHaveText("active");

		await listings.rowCheckbox(ADMIN_LISTING_ALPHA_TITLE).check();
		await listings.activateButton.click();
		await expect(listings.rowStatus(ADMIN_LISTING_ALPHA_TITLE)).toHaveText("active");
	});
});

test.describe("Admin users management", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	let users: AdminUsersPage;

	// Manual context for the same reason as the listings group above.
	test.beforeAll(async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: ADMIN_AUTH_STATE_PATH });
		page = await ctx.newPage();
		users = new AdminUsersPage(page);
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("search by email finds the user", async () => {
		await users.goto();
		await expect(users.heading).toBeVisible();
		await users.search(VIEWER_EMAIL);
		await expect(users.row(VIEWER_EMAIL)).toBeVisible();
		await expect(users.rows).toHaveCount(1);
	});

	test("search with no match shows empty state", async () => {
		await users.search("no-such-user@nowhere.example.com");
		await expect(users.emptyState).toBeVisible();
	});

	test("banned user cannot sign in", async ({ browser }) => {
		await users.search(BANNED_EMAIL);
		await expect(users.row(BANNED_EMAIL)).toBeVisible();
		// A failed earlier attempt (CI retry) may have left the user banned — normalise first.
		if (await users.unbanButton(BANNED_EMAIL).isVisible()) {
			await users.unban(BANNED_EMAIL);
		}
		await expect(users.rowStatus(BANNED_EMAIL)).toHaveText("Active");

		await users.ban(BANNED_EMAIL);
		await expect(users.rowStatus(BANNED_EMAIL)).toHaveText("Banned");

		const ctx = await browser.newContext();
		const loginTab = await ctx.newPage();
		const login = new LoginPage(loginTab);
		await login.goto();
		await login.login(BANNED_EMAIL, TEST_PASSWORD);
		await expect(login.errorMessage).toBeVisible();
		await ctx.close();
	});

	test("unbanned user can sign in again", async ({ browser }) => {
		await users.unban(BANNED_EMAIL);
		await expect(users.rowStatus(BANNED_EMAIL)).toHaveText("Active");

		const ctx = await browser.newContext();
		const loginTab = await ctx.newPage();
		await loginAs(loginTab, BANNED_EMAIL);
		await expect(loginTab).not.toHaveURL(/\/kirjaudu/);
		await ctx.close();
	});
});
