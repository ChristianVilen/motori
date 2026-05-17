import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("profile").dropColumn("license_class").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("profile").addColumn("license_class", sql`varchar`).execute();
}
