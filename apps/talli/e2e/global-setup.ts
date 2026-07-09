import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

// Load DATABASE_URL etc. so seeding in this setup process can talk to Postgres.
try {
	process.loadEnvFile(".env");
} catch {
	// .env may not exist in CI — rely on real env vars instead.
}

export const MOTORI_URL = "http://localhost:3000";
export const TALLI_URL = "http://localhost:3001";
export const TEST_EMAIL = "e2e-talli@test.example.com";
export const TEST_PASSWORD = "E2eTestPass123!";
export const AUTH_STATE_PATH = "e2e/.auth/user.json";

export default async function globalSetup() {
	if (!process.env.DATABASE_URL) {
		throw new Error(
			"Global setup: DATABASE_URL is not set. Ensure .env is present or the env var is exported.",
		);
	}

	fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

	const browser = await chromium.launch();
	const ctx = await browser.newContext();
	// Sign-up/sign-in run against motori (the auth host) — the resulting session
	// cookie is host-only on localhost, so it carries to talli on :3001.
	const headers = { Origin: MOTORI_URL };

	const signUpRes = await ctx.request.post(`${MOTORI_URL}/api/auth/sign-up/email`, {
		data: { name: "E2E Talli User", email: TEST_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!signUpRes.ok()) {
		const body = await signUpRes.text();
		const exists =
			signUpRes.status() === 422 ||
			body.includes("USER_ALREADY_EXISTS") ||
			body.includes("already exists");
		if (!exists) {
			throw new Error(
				`Global setup: sign-up failed (${signUpRes.status()}): ${body.slice(0, 200)}`,
			);
		}
	}

	const signInRes = await ctx.request.post(`${MOTORI_URL}/api/auth/sign-in/email`, {
		data: { email: TEST_EMAIL, password: TEST_PASSWORD },
		headers,
		failOnStatusCode: false,
	});
	if (!signInRes.ok()) {
		const body = await signInRes.text();
		throw new Error(`Global setup: sign-in failed (${signInRes.status()}): ${body.slice(0, 200)}`);
	}
	await ctx.storageState({ path: AUTH_STATE_PATH });
	await ctx.close();
	await browser.close();

	const { db } = await import("../src/lib/db/index");
	const user = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", TEST_EMAIL)
		.executeTakeFirst();
	if (!user) {
		throw new Error("Global setup: user not found after sign-up");
	}
	await db
		.updateTable("user")
		.set({ emailVerified: true, updatedAt: new Date() })
		.where("id", "=", user.id)
		.execute();
	// Idempotency: wipe this user's talli rows so each run starts from an empty garage.
	await db.deleteFrom("talli.vehicle").where("user_id", "=", user.id).execute();
	// Note: don't destroy the pool here — `db` is a module singleton reused by
	// global-teardown in the same process (mirrors motori's setup/teardown split).
}
