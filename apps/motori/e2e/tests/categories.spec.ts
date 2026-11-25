import { expect, test } from "@playwright/test";
import { BASE_URL } from "../base-url";
import { TEST_PASSWORD } from "../global-setup";
import { uniqueEmail, uniqueName } from "../helpers";
import { ListingsPage } from "../pages/listings.page";

test("sale browse page loads", async ({ page }) => {
	await page.goto("/pyorat/myynti");
	await expect(page.getByTestId("listings-result-count")).toBeVisible();
});

test("rental browse page loads", async ({ page }) => {
	await page.goto("/pyorat/vuokraus");
	await expect(page.getByTestId("listings-result-count")).toBeVisible();
});

test("gear browse page loads", async ({ page }) => {
	await page.goto("/varusteet");
	await expect(page.getByTestId("listings-result-count")).toBeVisible();
});

test("parts browse page loads", async ({ page }) => {
	await page.goto("/varaosat");
	await expect(page.getByTestId("listings-result-count")).toBeVisible();
});

test("load more shows the next page of a browse feed", async ({ page, request }) => {
	const email = uniqueEmail();
	const signUp = await request.post(`${BASE_URL}/api/auth/sign-up/email`, {
		data: { name: uniqueName(), email, password: TEST_PASSWORD },
		headers: { Origin: BASE_URL },
	});
	expect(signUp.ok()).toBeTruthy();
	const { db } = await import("../../src/lib/db/index");
	const owner = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirstOrThrow();
	const token = `loadmore${Date.now().toString(36)}`;
	try {
		for (let i = 0; i < 13; i++) {
			const id = crypto.randomUUID();
			await db
				.insertInto("listing")
				.values({
					id,
					short_id: id.slice(0, 8),
					owner_id: owner.id,
					title: `E2E ${token} kypärä ${i}`,
					category: "gear",
					make_id: null,
					model_id: null,
					year: null,
					engine_cc: null,
					required_license: null,
					motorcycle_type: null,
					city: "Helsinki",
					region: "uusimaa",
					postal_code: null,
					description: "E2E load more fixture.",
					expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
					// Old dates keep these rows off the first page that parallel tests read.
					created_at: new Date(Date.UTC(2020, 0, 1, 0, i)),
					updated_at: new Date(),
				})
				.execute();
			await db
				.insertInto("listing_gear")
				.values({
					listing_id: id,
					gear_type: "helmet",
					size: "M",
					brand: null,
					condition: "good",
					price: 10000 + i,
				})
				.execute();
		}

		const listings = new ListingsPage(page);
		await listings.gotoGear({ q: token });
		await expect(listings.cards).toHaveCount(12);
		await listings.loadMore();

		await expect(listings.cards).toHaveCount(13);
		await expect(listings.loadMoreButton).toBeHidden();
		await expect(page).toHaveURL(/cursor=/);
	} finally {
		await db.deleteFrom("user").where("id", "=", owner.id).execute();
	}
});
