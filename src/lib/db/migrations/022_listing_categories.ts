// Migration 022: Multi-category listings — Phase 1A
// - Add `category` column to listing (sale|rental|gear|part)
// - Create `listing_rental` table with rental-specific fields
// - Migrate existing listing data → listing_rental rows
// - Make motorcycle fields nullable (gear/parts won't have them)
// - Drop rental-specific columns from base listing
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// 1. Add category column (default 'rental' for existing rows)
	await sql`ALTER TABLE listing ADD COLUMN category text NOT NULL DEFAULT 'rental'`.execute(db);

	// 2. Create listing_rental table
	await db.schema
		.createTable("listing_rental")
		.addColumn("listing_id", "text", (col) =>
			col.primaryKey().references("listing.id").onDelete("cascade"),
		)
		.addColumn("price_per_day", "integer", (col) => col.notNull())
		.addColumn("price_per_week", "integer")
		.addColumn("price_per_weekend", "integer")
		.addColumn("price_description", "text")
		.addColumn("mileage_limit", "integer")
		.addColumn("availability_default", "text", (col) => col.notNull().defaultTo("open"))
		.execute();

	// 3. Migrate existing rental data into listing_rental
	await sql`
		INSERT INTO listing_rental (listing_id, price_per_day, price_per_week, price_per_weekend, price_description, mileage_limit, availability_default)
		SELECT id, price_per_day, price_per_week, price_per_weekend, price_description, mileage_limit, availability_default
		FROM listing
	`.execute(db);

	// 4. Make motorcycle fields nullable (gear/parts won't have them)
	await sql`ALTER TABLE listing ALTER COLUMN make_id DROP NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN year DROP NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN motorcycle_type DROP NOT NULL`.execute(db);

	// 5. Drop rental-specific columns from base listing
	await db.schema
		.alterTable("listing")
		.dropColumn("price_per_day")
		.dropColumn("price_per_week")
		.dropColumn("price_per_weekend")
		.dropColumn("price_description")
		.dropColumn("mileage_limit")
		.dropColumn("availability_default")
		.execute();

	// 6. Remove the default on category (was only for migration convenience)
	await sql`ALTER TABLE listing ALTER COLUMN category DROP DEFAULT`.execute(db);

	// 7. Add index on category + status
	await db.schema
		.createIndex("listing_category_status_idx")
		.on("listing")
		.columns(["category", "status"])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Re-add rental columns to listing
	await db.schema
		.alterTable("listing")
		.addColumn("price_per_day", "integer")
		.addColumn("price_per_week", "integer")
		.addColumn("price_per_weekend", "integer")
		.addColumn("price_description", "text")
		.addColumn("mileage_limit", "integer")
		.addColumn("availability_default", "text", (col) => col.defaultTo("open"))
		.execute();

	// Copy data back from listing_rental
	await sql`
		UPDATE listing SET
			price_per_day = lr.price_per_day,
			price_per_week = lr.price_per_week,
			price_per_weekend = lr.price_per_weekend,
			price_description = lr.price_description,
			mileage_limit = lr.mileage_limit,
			availability_default = lr.availability_default
		FROM listing_rental lr WHERE lr.listing_id = listing.id
	`.execute(db);

	// Make price_per_day NOT NULL again
	await sql`ALTER TABLE listing ALTER COLUMN price_per_day SET NOT NULL`.execute(db);

	// Restore NOT NULL on motorcycle fields
	await sql`ALTER TABLE listing ALTER COLUMN make_id SET NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN year SET NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN motorcycle_type SET NOT NULL`.execute(db);

	// Drop listing_rental and category
	await db.schema.dropIndex("listing_category_status_idx").execute();
	await db.schema.dropTable("listing_rental").execute();
	await sql`ALTER TABLE listing DROP COLUMN category`.execute(db);
}
