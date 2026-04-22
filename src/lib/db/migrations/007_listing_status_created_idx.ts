import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// In production with significant traffic, use CREATE INDEX CONCURRENTLY
	// (requires running outside a transaction) to avoid locking writes.
	await sql`CREATE INDEX listing_status_created_idx ON listing (status, created_at DESC)`.execute(
		db,
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex("listing_status_created_idx").execute();
}
