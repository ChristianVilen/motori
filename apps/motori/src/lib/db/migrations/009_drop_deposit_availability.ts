import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing")
		.dropColumn("deposit_amount")
		.dropColumn("available_from")
		.dropColumn("available_to")
		.dropColumn("season_only")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing")
		.addColumn("deposit_amount", "integer")
		.addColumn("available_from", "date")
		.addColumn("available_to", "date")
		.addColumn("season_only", "boolean", (col) => col.notNull().defaultTo(false))
		.execute();
}
