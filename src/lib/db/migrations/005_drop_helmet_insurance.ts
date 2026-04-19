import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing")
		.dropColumn("includes_helmet")
		.dropColumn("includes_insurance")
		.dropColumn("insurance_info")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing")
		.addColumn("includes_helmet", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("includes_insurance", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("insurance_info", "text")
		.execute();
}
