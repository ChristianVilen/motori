// Removes the talli e2e test user and their data (ON DELETE CASCADE handles
// talli.vehicle → reminders/service records/photos, plus session/account rows).
import { TEST_EMAIL } from "./global-setup";

try {
	process.loadEnvFile(".env");
} catch {
	// .env may not exist in CI — rely on real env vars instead.
}

export default async function globalTeardown() {
	if (!process.env.DATABASE_URL) {
		return;
	}
	const { db } = await import("../src/lib/db/index");
	await db.deleteFrom("user").where("email", "=", TEST_EMAIL).execute();
	await db.destroy();
}
