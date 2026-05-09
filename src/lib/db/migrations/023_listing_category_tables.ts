// Migration 023: Category-specific detail tables
// - listing_sale: bike sales with price, condition, km, negotiable flag
// - listing_gear: helmets, jackets, etc. with gear_type, size, condition, price
// - listing_part: spare parts with part_category, compatible make/model, condition, price
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("listing_sale")
		.addColumn("listing_id", "text", (col) =>
			col.primaryKey().references("listing.id").onDelete("cascade"),
		)
		.addColumn("price", "integer", (col) => col.notNull()) // EUR cents
		.addColumn("condition", "text", (col) => col.notNull()) // new|excellent|good|fair
		.addColumn("km_driven", "integer")
		.addColumn("negotiable", "boolean", (col) => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.createTable("listing_gear")
		.addColumn("listing_id", "text", (col) =>
			col.primaryKey().references("listing.id").onDelete("cascade"),
		)
		.addColumn("gear_type", "text", (col) => col.notNull()) // helmet|jacket|pants|boots|gloves|other
		.addColumn("size", "text")
		.addColumn("condition", "text", (col) => col.notNull()) // new|excellent|good|fair
		.addColumn("price", "integer", (col) => col.notNull()) // EUR cents
		.execute();

	await db.schema
		.createTable("listing_part")
		.addColumn("listing_id", "text", (col) =>
			col.primaryKey().references("listing.id").onDelete("cascade"),
		)
		.addColumn("part_category", "text", (col) => col.notNull())
		.addColumn("compatible_make_id", "text", (col) => col.references("motorcycle_make.id"))
		.addColumn("compatible_model_id", "text", (col) => col.references("motorcycle_model.id"))
		.addColumn("condition", "text", (col) => col.notNull()) // new|excellent|good|fair
		.addColumn("price", "integer", (col) => col.notNull()) // EUR cents
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("listing_part").execute();
	await db.schema.dropTable("listing_gear").execute();
	await db.schema.dropTable("listing_sale").execute();
}
