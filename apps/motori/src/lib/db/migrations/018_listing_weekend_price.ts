import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing ADD COLUMN price_per_weekend integer`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing DROP COLUMN price_per_weekend`.execute(db);
}
