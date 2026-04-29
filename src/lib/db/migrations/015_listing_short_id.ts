import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing ADD COLUMN short_id varchar(8)`.execute(db);
	// Backfill existing rows (dev/e2e only — prod has no rows at this point)
	await sql`UPDATE listing SET short_id = substr(md5(id::text), 1, 8) WHERE short_id IS NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN short_id SET NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ADD CONSTRAINT listing_short_id_unique UNIQUE (short_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing DROP COLUMN short_id`.execute(db);
}
