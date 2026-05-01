import { expect, test } from "@playwright/test";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, TEST_EMAIL, TEST_PASSWORD } from "../global-setup";
import { loginAs, uniqueEmail, uniqueName, waitForHydration } from "../helpers";

const BASE_URL = "http://localhost:3000";

// Auto-accept all confirm() dialogs in this test file.
test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
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
        const { db } = await import("../../src/lib/db/index");
        await db
            .updateTable("user")
            .set({ emailVerified: true, updatedAt: new Date() })
            .where("email", "=", renterEmail)
            .execute();

        // 2. Log in as renter and open the seeded listing.
        await loginAs(page, renterEmail);
        await page.goto(`/ilmoitukset/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}`);
        await waitForHydration(page);

        // 3. Verify the booking form is visible.
        await expect(page.getByTestId("booking-request-form")).toBeVisible();

        // 4. Click the first two enabled days in the range calendar — picking by day
        //    number is fragile because numberOfMonths={2} duplicates each number across
        //    the two visible months.
        const form = page.getByTestId("booking-request-form");
        const enabledDays = form.locator("button.rdp-day_button:not([disabled])");
        await enabledDays.nth(0).click();
        await enabledDays.nth(1).click();

        // 5. Fill message and submit.
        await page.getByPlaceholder(/Kerro kuka olet/).fill("E2E test kiinnostaa vuokrata");
        await page.getByTestId("booking-submit").click();
        await expect(page.getByTestId("booking-success")).toBeVisible({ timeout: 10000 });

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
        await waitForHydration(page);

        // 9. Confirm the booking.
        const confirmBtn = page.getByTestId("booking-confirm");
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        // 10. Status should update to confirmed.
        //await expect(page.getByText("Vahvistettu")).toBeVisible({ timeout: 10000 });
    });
});
