import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../global-setup";
import { loginAs, uniqueEmail, uniqueName, waitForHydration } from "../helpers";

const BASE_URL = "http://localhost:3000";

// Accept all confirm dialogs automatically.
test.beforeEach(async ({ page }) => {
	page.on("dialog", (d) => d.accept());
});

/** Create a fresh user via sign-up + DB email verification flip + profile insert. */
async function createVerifiedUser(
	request: {
		post: (url: string, opts?: Record<string, unknown>) => Promise<{ ok: () => boolean }>;
	},
	email: string,
	name: string,
): Promise<{ userId: string }> {
	const signUp = await request.post(`${BASE_URL}/api/auth/sign-up/email`, {
		data: { name, email, password: TEST_PASSWORD },
		headers: { Origin: BASE_URL },
	});
	expect(signUp.ok()).toBeTruthy();

	const { db } = await import("../../src/lib/db/index");
	const user = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirstOrThrow();
	await db
		.updateTable("user")
		.set({ emailVerified: true, updatedAt: new Date() })
		.where("email", "=", email)
		.execute();
	await db
		.insertInto("profile")
		.values({ user_id: user.id, display_name: name, language: "fi" })
		.execute();
	return { userId: user.id };
}

/** Seed a confirmed past booking owned by seedOwner with a new renter. */
async function seedConfirmedPastBooking(
	seedOwnerEmail: string,
	request: {
		post: (url: string, opts?: Record<string, unknown>) => Promise<{ ok: () => boolean }>;
	},
): Promise<{
	bookingShortId: string;
	ownerId: string;
	renterId: string;
	ownerEmail: string;
	renterEmail: string;
}> {
	const { db } = await import("../../src/lib/db/index");

	const endDate = new Date();
	endDate.setDate(endDate.getDate() - 1);
	const endStr = endDate.toISOString().slice(0, 10);

	const owner = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", seedOwnerEmail)
		.executeTakeFirstOrThrow();

	const renterEmail = uniqueEmail();
	const renterName = uniqueName();
	const { userId: renterId } = await createVerifiedUser(request, renterEmail, renterName);

	const make = await db
		.selectFrom("motorcycle_make")
		.select("id")
		.where("slug", "=", "honda-e2e")
		.executeTakeFirst();

	const makeId = make?.id ?? crypto.randomUUID();
	if (!make) {
		await db
			.insertInto("motorcycle_make")
			.values({ id: makeId, name: "Honda", slug: "honda-e2e" })
			.execute();
	}

	const listingId = crypto.randomUUID();
	await db
		.insertInto("listing")
		.values({
			id: listingId,
			short_id: crypto.randomUUID().slice(0, 8),
			owner_id: owner.id,
			title: "E2E Review Test Bike",
			category: "rental",
			make_id: makeId,
			model_id: null,
			year: 2020,
			engine_cc: 500,
			required_license: "A2",
			motorcycle_type: "naked",
			city: "Helsinki",
			region: "uusimaa",
			postal_code: null,
			description: "Review test listing.",
			expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	await db
		.insertInto("listing_rental")
		.values({ listing_id: listingId, price_per_day: 4500 })
		.execute();

	const bookingId = crypto.randomUUID();
	const bookingShortId = crypto.randomUUID().slice(0, 8);
	const startDate = new Date(endDate);
	startDate.setDate(startDate.getDate() - 2);
	const startStr = startDate.toISOString().slice(0, 10);

	await db
		.insertInto("booking")
		.values({
			id: bookingId,
			short_id: bookingShortId,
			listing_id: listingId,
			renter_user_id: renterId,
			status: "confirmed",
			message: "E2E review test booking",
			start_date: startStr,
			end_date: endStr,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	return { bookingShortId, ownerId: owner.id, renterId, ownerEmail: seedOwnerEmail, renterEmail };
}

test.describe("Reviews", () => {
	test("submit review as renter and see waiting-for-reveal state", async ({ page, request }) => {
		const ownerEmail = uniqueEmail();
		const ownerName = uniqueName();
		await createVerifiedUser(request, ownerEmail, ownerName);

		const { bookingShortId, renterEmail } = await seedConfirmedPastBooking(ownerEmail, request);

		await loginAs(page, renterEmail);
		await page.goto(`/omat/varaukset/${bookingShortId}`);
		await waitForHydration(page);
		await expect(page.getByTestId("review-section")).toBeVisible();

		await page.getByTestId("review-section").getByLabel("4 / 5").click();
		await page.getByTestId("review-submit").click();
		await expect(page.getByText(/näytetä vielä/)).toBeVisible({ timeout: 5000 });
	});

	test("both parties review and reviews appear on profile", async ({ page, request }) => {
		const seedOwnerEmail = uniqueEmail();
		const seedOwnerName = uniqueName();
		await createVerifiedUser(request, seedOwnerEmail, seedOwnerName);

		const { bookingShortId, ownerId, renterId, renterEmail } = await seedConfirmedPastBooking(
			seedOwnerEmail,
			request,
		);

		// Renter submits a 5-star review.
		await loginAs(page, renterEmail);
		await page.goto(`/omat/varaukset/${bookingShortId}`);
		await waitForHydration(page);
		await expect(page.getByTestId("review-section")).toBeVisible();
		await page.getByTestId("review-section").getByLabel("5 / 5").click();
		await page.getByTestId("review-submit").click();
		await expect(page.getByText(/näytetä vielä/)).toBeVisible();

		// Sign out renter.
		await page.context().clearCookies();

		// Owner submits a 4-star review.
		await loginAs(page, seedOwnerEmail);
		await page.goto(`/omat/varaukset/${bookingShortId}`);
		await waitForHydration(page);
		await expect(page.getByTestId("review-section")).toBeVisible();
		await page.getByTestId("review-section").getByLabel("4 / 5").click();
		await page.getByTestId("review-submit").click();
		await expect(page.getByText(/näytetä vielä/)).toBeVisible();

		// Renter profile: shows owner's 4★ review.
		await page.goto(`/profiili/${renterId}`);
		await waitForHydration(page);
		const renterReviews = page.getByTestId("reviews-section");
		await expect(renterReviews).toBeVisible();
		await expect(renterReviews).toContainText("★★★★");
		await expect(page.getByText(/4 ★ \(1 arvostelu\)/)).toBeVisible();

		// Owner profile: shows renter's 5★ review.
		await page.goto(`/profiili/${ownerId}`);
		await waitForHydration(page);
		const ownerReviews = page.getByTestId("reviews-section");
		await expect(ownerReviews).toBeVisible();
		await expect(ownerReviews).toContainText("★★★★★");
		await expect(page.getByText(/5 ★ \(1 arvostelu\)/)).toBeVisible();
	});

	test("review section does not appear for pending booking", async ({ page, request }) => {
		const { db } = await import("../../src/lib/db/index");

		const ownerEmail = uniqueEmail();
		const ownerName = uniqueName();
		const { userId: ownerId } = await createVerifiedUser(request, ownerEmail, ownerName);

		const renterEmail = uniqueEmail();
		const renterName = uniqueName();
		const { userId: renterId } = await createVerifiedUser(request, renterEmail, renterName);

		const endDate = new Date();
		endDate.setDate(endDate.getDate() - 1);
		const endStr = endDate.toISOString().slice(0, 10);
		const startDate = new Date(endStr);
		startDate.setDate(startDate.getDate() - 2);
		const startStr = startDate.toISOString().slice(0, 10);

		const listingId = crypto.randomUUID();
		await db
			.insertInto("listing")
			.values({
				id: listingId,
				short_id: crypto.randomUUID().slice(0, 8),
				owner_id: ownerId,
				title: "E2E Pending Booking Test",
				category: "rental",
				make_id:
					(
						await db
							.selectFrom("motorcycle_make")
							.select("id")
							.where("slug", "=", "honda-e2e")
							.executeTakeFirst()
					)?.id ?? crypto.randomUUID(),
				model_id: null,
				year: 2021,
				engine_cc: 500,
				required_license: "A2",
				motorcycle_type: "naked",
				city: "Helsinki",
				region: "uusimaa",
				postal_code: null,
				description: "Pending booking review test.",
				expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		await db
			.insertInto("listing_rental")
			.values({ listing_id: listingId, price_per_day: 4500 })
			.execute();

		const bookingId = crypto.randomUUID();
		const bookingShortId = crypto.randomUUID().slice(0, 8);
		await db
			.insertInto("booking")
			.values({
				id: bookingId,
				short_id: bookingShortId,
				listing_id: listingId,
				renter_user_id: renterId,
				status: "pending",
				message: "Pending booking — no review allowed",
				start_date: startStr,
				end_date: endStr,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		// Log in as renter.
		await loginAs(page, renterEmail);
		await page.goto(`/omat/varaukset/${bookingShortId}`);
		await waitForHydration(page);

		// Review section should NOT be visible for pending booking.
		await expect(page.getByTestId("review-section")).not.toBeVisible();
	});

	test("review revealed after 14-day deadline even with one review", async ({ page, request }) => {
		// Use unique owner so we see exactly 1 review on their profile.
		const ownerEmail = uniqueEmail();
		const ownerName = uniqueName();
		const { userId: ownerId } = await createVerifiedUser(request, ownerEmail, ownerName);

		const endDate = new Date();
		endDate.setDate(endDate.getDate() - 15);
		const endStr = endDate.toISOString().slice(0, 10);

		const { db } = await import("../../src/lib/db/index");

		const renterEmail = uniqueEmail();
		const renterName = uniqueName();
		const { userId: renterId } = await createVerifiedUser(request, renterEmail, renterName);

		const make = await db
			.selectFrom("motorcycle_make")
			.select("id")
			.where("slug", "=", "honda-e2e")
			.executeTakeFirst();
		const makeId = make?.id ?? crypto.randomUUID();
		if (!make) {
			await db
				.insertInto("motorcycle_make")
				.values({ id: makeId, name: "Honda", slug: "honda-e2e" })
				.execute();
		}

		const listingId = crypto.randomUUID();
		await db
			.insertInto("listing")
			.values({
				id: listingId,
				short_id: crypto.randomUUID().slice(0, 8),
				owner_id: ownerId,
				title: "E2E Deadline Review Test",
				category: "rental",
				make_id: makeId,
				model_id: null,
				year: 2020,
				engine_cc: 500,
				required_license: "A2",
				motorcycle_type: "naked",
				city: "Helsinki",
				region: "uusimaa",
				postal_code: null,
				description: "Deadline review test.",
				expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		await db
			.insertInto("listing_rental")
			.values({ listing_id: listingId, price_per_day: 4500 })
			.execute();

		const bookingId = crypto.randomUUID();
		const startDate = new Date(endDate);
		startDate.setDate(startDate.getDate() - 2);
		const startStr = startDate.toISOString().slice(0, 10);
		await db
			.insertInto("booking")
			.values({
				id: bookingId,
				short_id: crypto.randomUUID().slice(0, 8),
				listing_id: listingId,
				renter_user_id: renterId,
				status: "confirmed",
				message: "Deadline test",
				start_date: startStr,
				end_date: endStr,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		await db
			.insertInto("review")
			.values({
				booking_id: bookingId,
				reviewer_id: renterId,
				target_user_id: ownerId,
				rating: 5,
				comment: "Hieno pyörä!",
			})
			.execute();

		await loginAs(page, ownerEmail);
		await page.goto(`/profiili/${ownerId}`);
		await waitForHydration(page);

		await expect(page.getByTestId("reviews-section")).toBeVisible();
		await expect(page.getByTestId("reviews-section")).toContainText("Hieno pyörä!");
		await expect(page.getByText(/5 ★ \(1 arvostelu\)/)).toBeVisible();
	});
});
