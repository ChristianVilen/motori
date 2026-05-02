import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

// Load DATABASE_URL etc. so seeding in this setup process can talk to Postgres.
try {
	process.loadEnvFile(".env");
} catch {
	// .env may not exist in CI — rely on real env vars instead.
}

const BASE_URL = "http://localhost:3000";
export const TEST_EMAIL = "e2e-user@test.example.com";
export const TEST_PASSWORD = "E2eTestPass123!";
export const AUTH_STATE_PATH = "e2e/.auth/user.json";

// Second user that is NOT the seeded listing owner — used for non-owner view tests.
export const VIEWER_EMAIL = "e2e-viewer@test.example.com";
export const VIEWER_AUTH_STATE_PATH = "e2e/.auth/viewer.json";

// Deterministic IDs for the e2e seed listing
// UUID must be valid RFC 4122 (version nibble=4, variant nibble=8/9/a/b) so Zod v4 accepts it.
export const SEEDED_LISTING_UUID = "11111111-1111-4111-8111-111111111111"; // stable DB id
export const SEEDED_LISTING_ID = "e2eseed1"; // short_id — used in URLs and data-listing-id
export const SEEDED_LISTING_SLUG = "honda-e2e-helsinki"; // make slug + city
export const SEEDED_LISTING_TITLE = "E2E Seed Honda CB500F 2022";

export default async function globalSetup() {
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"Global setup: DATABASE_URL is not set. Ensure .env is present or the env var is exported.",
		);
	}

	fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

	const browser = await chromium.launch();
	const context = await browser.newContext();

	const headers = { Origin: BASE_URL };

	// Sign up owner (TEST_EMAIL). 422/409-style "already exists" errors are expected on reruns.
	const signUpRes = await context.request.post(`${BASE_URL}/api/auth/sign-up/email`, {
		data: { name: "E2E Test User", email: TEST_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!signUpRes.ok()) {
		const body = await signUpRes.text();
		const isAlreadyExists =
			signUpRes.status() === 422 ||
			body.includes("USER_ALREADY_EXISTS") ||
			body.includes("already exists");
		if (!isAlreadyExists) {
			throw new Error(
				`Global setup: sign-up failed with status ${signUpRes.status()}: ${body.slice(0, 200)}`,
			);
		}
	}

	const signInRes = await context.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
		data: { email: TEST_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!signInRes.ok()) {
		const body = await signInRes.text();
		throw new Error(
			`Global setup: sign-in failed with status ${signInRes.status()}. ` +
				`Server must run with DISABLE_EMAIL_VERIFICATION=true. Body: ${body.slice(0, 200)}`,
		);
	}
	await context.storageState({ path: AUTH_STATE_PATH });

	// Sign up viewer (separate account, never owns any seeded listings).
	const viewerCtx = await browser.newContext();
	const viewerSignUpRes = await viewerCtx.request.post(`${BASE_URL}/api/auth/sign-up/email`, {
		data: { name: "E2E Viewer", email: VIEWER_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!viewerSignUpRes.ok()) {
		const body = await viewerSignUpRes.text();
		const isAlreadyExists =
			viewerSignUpRes.status() === 422 ||
			body.includes("USER_ALREADY_EXISTS") ||
			body.includes("already exists");
		if (!isAlreadyExists) {
			throw new Error(
				`Global setup: viewer sign-up failed with status ${viewerSignUpRes.status()}: ${body.slice(0, 200)}`,
			);
		}
	}
	const viewerSignInRes = await viewerCtx.request.post(`${BASE_URL}/api/auth/sign-in/email`, {
		data: { email: VIEWER_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!viewerSignInRes.ok()) {
		const body = await viewerSignInRes.text();
		throw new Error(
			`Global setup: viewer sign-in failed with status ${viewerSignInRes.status()}. Body: ${body.slice(0, 200)}`,
		);
	}
	await viewerCtx.storageState({ path: VIEWER_AUTH_STATE_PATH });

	await browser.close();

	const userId = await resolveTestUserId(TEST_EMAIL);
	const viewerId = await resolveTestUserId(VIEWER_EMAIL);
	await verifyEmail(userId);
	await verifyEmail(viewerId);
	await seedProfile(userId, "E2E Test User");
	await seedProfile(viewerId, "E2E Viewer");
	await seedListings(userId);
}

async function resolveTestUserId(email: string): Promise<string> {
	const { db } = await import("../src/lib/db/index");
	const user = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirst();
	if (!user) {
		throw new Error(`Global setup: user ${email} not found after sign-up`);
	}
	return user.id;
}

async function verifyEmail(userId: string) {
	const { db } = await import("../src/lib/db/index");
	await db
		.updateTable("user")
		.set({ emailVerified: true, updatedAt: new Date() })
		.where("id", "=", userId)
		.execute();
}

async function seedProfile(userId: string, displayName: string) {
	const { db } = await import("../src/lib/db/index");
	await db
		.insertInto("profile")
		.values({
			user_id: userId,
			display_name: displayName,
			language: "fi",
		})
		.onConflict((oc) => oc.column("user_id").doUpdateSet({ display_name: displayName }))
		.execute();
}

async function seedListings(ownerId: string) {
	const { db } = await import("../src/lib/db/index");

	// Idempotent: delete any prior seed rows first so tests always see a known state.
	await db.deleteFrom("listing").where("id", "=", SEEDED_LISTING_UUID).execute();

	// Clean up e2e make from previous run, then re-insert.
	// listing.make_id has no ON DELETE CASCADE, so clean up dependent listings first.
	const priorMake = await db
		.selectFrom("motorcycle_make")
		.select("id")
		.where("slug", "=", "honda-e2e")
		.executeTakeFirst();
	if (priorMake) {
		await db.deleteFrom("listing").where("make_id", "=", priorMake.id).execute();
		await db.deleteFrom("motorcycle_make").where("id", "=", priorMake.id).execute();
	}
	const e2eMake = await db
		.insertInto("motorcycle_make")
		.values({ id: crypto.randomUUID(), name: "Honda", slug: "honda-e2e" })
		.returningAll()
		.executeTakeFirstOrThrow();

	await db
		.insertInto("listing")
		.values({
			id: SEEDED_LISTING_UUID,
			short_id: SEEDED_LISTING_ID,
			owner_id: ownerId,
			title: SEEDED_LISTING_TITLE,
			make_id: e2eMake.id,
			model_id: null,
			year: 2022,
			engine_cc: 471,
			required_license: "A2",
			motorcycle_type: "naked",
			price_per_day: 5500,
			price_per_week: 30000,
			price_description: null,
			city: "Helsinki",
			region: "uusimaa",
			postal_code: null,
			description:
				"E2E seed listing. Do not edit manually — global-setup recreates this row on every run.",
			mileage_limit: 200,
			expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();
}
