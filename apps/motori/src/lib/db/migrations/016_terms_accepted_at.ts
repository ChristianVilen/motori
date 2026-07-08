import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("profile").addColumn("terms_accepted_at", "timestamptz").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("profile").dropColumn("terms_accepted_at").execute();
}
