// Adds GIN trigram indexes on tori_item and listing for prefix and
// fuzzy matching. pg_trgm extension already exists from migration 004.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE INDEX tori_item_trgm_idx ON tori_item
		USING gin ((title || ' ' || description) gin_trgm_ops)
	`.execute(db);

	await sql`
		CREATE INDEX listing_trgm_idx ON listing
		USING gin ((title || ' ' || description) gin_trgm_ops)
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP INDEX IF EXISTS listing_trgm_idx`.execute(db);
	await sql`DROP INDEX IF EXISTS tori_item_trgm_idx`.execute(db);
}
