// Removes all e2e test users and their data (ON DELETE CASCADE handles listings, tori items, etc.)
try {
	process.loadEnvFile(".env");
} catch {
	// .env may not exist in CI
}

export default async function globalTeardown() {
	if (!process.env.DATABASE_URL) {
		return;
	}

	const { db } = await import("../src/lib/db/index");

	await db
		.deleteFrom("user")
		.where("email", "in", [
			"e2e-user@test.example.com",
			"e2e-viewer@test.example.com",
			"e2e-lifecycle@test.example.com",
		])
		.execute();

	// Clean up the e2e make
	const e2eMake = await db
		.selectFrom("motorcycle_make")
		.select("id")
		.where("slug", "=", "honda-e2e")
		.executeTakeFirst();
	if (e2eMake) {
		await db.deleteFrom("listing").where("make_id", "=", e2eMake.id).execute();
		await db.deleteFrom("motorcycle_make").where("id", "=", e2eMake.id).execute();
	}

	await db.destroy();
}
