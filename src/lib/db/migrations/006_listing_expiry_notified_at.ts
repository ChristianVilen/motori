import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("listing").addColumn("expiry_notified_at", "timestamptz").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("listing").dropColumn("expiry_notified_at").execute();
}
