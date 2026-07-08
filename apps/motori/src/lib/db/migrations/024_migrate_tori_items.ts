// Migration 024: Migrate tori_items into unified listing system
// - tori_item with category gear|apparel → listing (category='gear') + listing_gear
//   (apparel collapses into gear — no separate category in the new system)
// - tori_item with category parts|tools → listing (category='part') + listing_part
// - tori_item_image → listing_image
// - Drop tori_item_image, tori_item tables
//
// NOTE: The down migration recreates the tables but data fidelity is not guaranteed.
// This is acceptable for dev; do not roll back in staging/prod with real data.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// 1. Insert gear/apparel tori_items as listing + listing_gear
	await sql`
		INSERT INTO listing (id, owner_id, short_id, title, category, city, region, postal_code, description, status, view_count, expires_at, expiry_notified_at, search_vector, created_at, updated_at)
		SELECT id, owner_id, short_id, title, 'gear', city, region, postal_code, description,
			CASE WHEN status = 'sold' THEN 'removed' ELSE status END,
			view_count, expires_at, expiry_notified_at, search_vector, created_at, updated_at
		FROM tori_item
		WHERE category IN ('gear', 'apparel')
	`.execute(db);

	await sql`
		INSERT INTO listing_gear (listing_id, gear_type, condition, price)
		SELECT id, CASE WHEN category = 'apparel' THEN 'other' ELSE 'other' END, condition, price_cents
		FROM tori_item
		WHERE category IN ('gear', 'apparel')
	`.execute(db);

	// 2. Insert parts/tools tori_items as listing + listing_part
	await sql`
		INSERT INTO listing (id, owner_id, short_id, title, category, city, region, postal_code, description, status, view_count, expires_at, expiry_notified_at, search_vector, created_at, updated_at)
		SELECT id, owner_id, short_id, title, 'part', city, region, postal_code, description,
			CASE WHEN status = 'sold' THEN 'removed' ELSE status END,
			view_count, expires_at, expiry_notified_at, search_vector, created_at, updated_at
		FROM tori_item
		WHERE category IN ('parts', 'tools')
	`.execute(db);

	await sql`
		INSERT INTO listing_part (listing_id, part_category, condition, price)
		SELECT id, category, condition, price_cents
		FROM tori_item
		WHERE category IN ('parts', 'tools')
	`.execute(db);

	// 3. Migrate images
	await sql`
		INSERT INTO listing_image (id, listing_id, url, thumbnail_url, "order")
		SELECT id, item_id, url, thumbnail_url, "order"
		FROM tori_item_image
	`.execute(db);

	// 4. Drop tori tables
	await sql`DROP TRIGGER IF EXISTS tori_item_fts_trigger ON tori_item`.execute(db);
	await sql`DROP FUNCTION IF EXISTS tori_item_fts_update`.execute(db);
	await db.schema.dropTable("tori_item_image").execute();
	await db.schema.dropTable("tori_item").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Recreate tori_item tables (simplified — data loss on rollback is acceptable for dev)
	await db.schema
		.createTable("tori_item")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("owner_id", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
		.addColumn("short_id", "varchar(8)", (col) => col.notNull().unique())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("category", "text", (col) => col.notNull())
		.addColumn("condition", "text", (col) => col.notNull())
		.addColumn("price_cents", "integer", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("city", "text", (col) => col.notNull())
		.addColumn("region", "text", (col) => col.notNull())
		.addColumn("postal_code", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("expires_at", "timestamptz", (col) => col.notNull())
		.addColumn("expiry_notified_at", "timestamptz")
		.addColumn("search_vector", sql`tsvector`)
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();

	await db.schema
		.createTable("tori_item_image")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("item_id", "text", (col) =>
			col.notNull().references("tori_item.id").onDelete("cascade"),
		)
		.addColumn("url", "text", (col) => col.notNull())
		.addColumn("thumbnail_url", "text")
		.addColumn("order", "integer", (col) => col.notNull().defaultTo(0))
		.execute();

	// Move data back from listing to tori_item
	await sql`
		INSERT INTO tori_item (id, owner_id, short_id, title, category, condition, price_cents, description, city, region, postal_code, status, view_count, expires_at, expiry_notified_at, search_vector, created_at, updated_at)
		SELECT l.id, l.owner_id, l.short_id, l.title,
			COALESCE(lg.gear_type, lp.part_category, 'gear'),
			COALESCE(lg.condition, lp.condition, 'good'),
			COALESCE(lg.price, lp.price, 0),
			l.description, l.city, l.region, l.postal_code,
			CASE WHEN l.status = 'removed' THEN 'sold' ELSE l.status END,
			l.view_count, l.expires_at, l.expiry_notified_at, l.search_vector, l.created_at, l.updated_at
		FROM listing l
		LEFT JOIN listing_gear lg ON lg.listing_id = l.id
		LEFT JOIN listing_part lp ON lp.listing_id = l.id
		WHERE l.category IN ('gear', 'part')
	`.execute(db);

	await sql`
		INSERT INTO tori_item_image (id, item_id, url, thumbnail_url, "order")
		SELECT li.id, li.listing_id, li.url, li.thumbnail_url, li."order"
		FROM listing_image li
		INNER JOIN listing l ON l.id = li.listing_id
		WHERE l.category IN ('gear', 'part')
	`.execute(db);

	// Remove migrated rows from listing tables
	await sql`DELETE FROM listing WHERE category IN ('gear', 'part')`.execute(db);

	// Recreate FTS trigger
	await sql`
		CREATE OR REPLACE FUNCTION tori_item_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.description, '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.city, '')), 'C') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.region, '')), 'C');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await sql`
		CREATE TRIGGER tori_item_fts_trigger
			BEFORE INSERT OR UPDATE ON tori_item
			FOR EACH ROW EXECUTE FUNCTION tori_item_fts_update()
	`.execute(db);
}
