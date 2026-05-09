// Migration 025: Business account fields on profile
// - account_type: 'private' | 'business' (default private)
// - business_name: nullable text, shown when account_type = 'business'
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE profile ADD COLUMN account_type text NOT NULL DEFAULT 'private'`.execute(
		db,
	);
	await sql`ALTER TABLE profile ADD COLUMN business_name text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("profile")
		.dropColumn("business_name")
		.dropColumn("account_type")
		.execute();
}
