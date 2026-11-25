import { expect, test } from "@playwright/test";
import { addDaysToIso, toIso } from "../../src/lib/calendar-helpers";
import { BASE_URL } from "../base-url";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, TEST_EMAIL, TEST_PASSWORD } from "../global-setup";
import { loginAs, uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { ListingDetailPage } from "../pages/listing-detail.page";

// Auto-accept all confirm() dialogs in this test file.
test.beforeEach(async ({ page }) => {
	page.on("dialog", (d) => d.accept());
});

test.describe("Rental calendar keyboard", () => {
	test("arrow keys move between days and Enter picks the range", async ({ page }) => {
		const detail = new ListingDetailPage(page);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		const today = toIso(new Date());
		const from = addDaysToIso(today, 21);
		const to = addDaysToIso(today, 23);

		await detail.focusDate(addDaysToIso(today, 20));
		await detail.pressCalendarKey("ArrowRight");
		await detail.pressCalendarKey("Enter");
		await expect(page).toHaveURL(new RegExp(`from=${from}`));
		await detail.pressCalendarKey("ArrowRight");
		await detail.pressCalendarKey("ArrowRight");
		await detail.pressCalendarKey("Enter");

		await expect(page).toHaveURL(new RegExp(`from=${from}`));
		await expect(page).toHaveURL(new RegExp(`to=${to}`));
		await expect(detail.summary).toContainText("Yhteensä");
	});
});

test.describe("Booking flow", () => {
	test("renter submits, owner confirms, contact revealed", async ({ page, request }) => {
		// 1. Create a fresh renter account (no email verification in CI).
		const renterEmail = uniqueEmail();
		const renterName = uniqueName();
		const signUp = await request.post(`${BASE_URL}/api/auth/sign-up/email`, {
			data: { name: renterName, email: renterEmail, password: TEST_PASSWORD },
			headers: { Origin: BASE_URL },
		});
		expect(signUp.ok()).toBeTruthy();

		// DISABLE_EMAIL_VERIFICATION=true allows sign-in but does not set emailVerified.
		// requireVerifiedEmail() blocks booking submit; flip the flag directly.
		// Also create a profile — submitBookingRequest requires one for the renter.
		const { db } = await import("../../src/lib/db/index");
		const renterUser = await db
			.selectFrom("user")
			.select("id")
			.where("email", "=", renterEmail)
			.executeTakeFirstOrThrow();
		await db
			.updateTable("user")
			.set({ emailVerified: true, updatedAt: new Date() })
			.where("email", "=", renterEmail)
			.execute();
		await db
			.insertInto("profile")
			.values({ user_id: renterUser.id, display_name: renterName, language: "fi" })
			.execute();

		// 2. Log in as renter and open the seeded listing.
		await loginAs(page, renterEmail);
		const detail = new ListingDetailPage(page);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		const today = toIso(new Date());
		const from = addDaysToIso(today, 8),
			to = addDaysToIso(today, 9);
		await detail.selectDate(from);
		await detail.selectDate(to);
		await expect(page).toHaveURL(new RegExp(`to=${to}`));
		await detail.reload();
		await expect(detail.summary).toContainText("Yhteensä");
		await detail.message.fill("E2E test kiinnostaa vuokrata");
		await detail.submit.click();
		await expect(detail.success).toBeVisible();

		// 6. Sign out the renter.
		await page.context().clearCookies();

		// 7. Log in as the owner (seeded test user) and navigate to bookings.
		await loginAs(page, TEST_EMAIL);
		await page.goto("/omat/varaukset");
		await waitForHydration(page);

		// 8. Switch to incoming tab and open the booking.
		await page.getByTestId("bookings-tab-incoming").click();
		const row = page.getByTestId("booking-row").first();
		await expect(row).toBeVisible();
		await row.click();

		// 9. Confirm the booking. Use a long timeout: waitForURL resolves as soon as
		// TanStack Router pushes state, but the route data fetch is still in-flight.
		const confirmBtn = page.getByTestId("booking-confirm");
		await expect(confirmBtn).toBeVisible({ timeout: 15000 });
		await confirmBtn.click();

		// 10. Status should update to confirmed.
		await expect(page.getByText("Vahvistettu")).toBeVisible({ timeout: 10000 });
		await expect(page.getByRole("link", { name: renterEmail, exact: true })).toHaveAttribute(
			"href",
			`mailto:${renterEmail}`,
		);
		await page.context().clearCookies();
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await detail.selectDate(addDaysToIso(today, 7));
		await detail.selectDate(addDaysToIso(today, 10));
		await expect(detail.blockedNotice).toBeVisible();
		await expect(page).toHaveURL(new RegExp(`from=${addDaysToIso(today, 10)}$`));
	});
});
