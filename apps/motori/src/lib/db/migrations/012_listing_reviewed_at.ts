import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("listing").addColumn("reviewed_at", "timestamptz").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("listing").dropColumn("reviewed_at").execute();
}
