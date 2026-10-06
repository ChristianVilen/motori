// Migration 031: listing_sale.power_kw becomes numeric(5, 1) (#247)
// One decimal keeps every whole hv value stable through hv -> kW -> hv (100 hv = 73.5 kW).
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing_sale")
		.alterColumn("power_kw", (col) => col.setDataType("numeric(5, 1)"))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing_sale")
		.alterColumn("power_kw", (col) => col.setDataType("integer"))
		.execute();
}
