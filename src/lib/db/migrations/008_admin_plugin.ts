import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("user")
		.addColumn("role", "text", (col) => col.notNull().defaultTo("user"))
		.addColumn("banned", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("banReason", "text")
		.addColumn("banExpires", "timestamptz")
		.execute();

	await db.schema.alterTable("session").addColumn("impersonatedBy", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("session").dropColumn("impersonatedBy").execute();

	await db.schema
		.alterTable("user")
		.dropColumn("banExpires")
		.dropColumn("banReason")
		.dropColumn("banned")
		.dropColumn("role")
		.execute();
}
