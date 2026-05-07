// Creates: tori_item, tori_item_image tables.
// Full-text search (finnish_unaccent config) maintained by BEFORE INSERT/UPDATE trigger.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// ── tori_item ────────────────────────────────────────────────────────────────
	await db.schema
		.createTable("tori_item")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("owner_id", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
		.addColumn("short_id", "varchar(8)", (col) => col.notNull().unique())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("category", "text", (col) => col.notNull()) // gear|parts|apparel|tools
		.addColumn("condition", "text", (col) => col.notNull()) // new|excellent|good|fair|poor
		.addColumn("price_cents", "integer", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("city", "text", (col) => col.notNull())
		.addColumn("region", "text", (col) => col.notNull())
		.addColumn("postal_code", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active")) // active|paused|sold|expired
		.addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("expires_at", "timestamptz", (col) => col.notNull())
		.addColumn("expiry_notified_at", "timestamptz")
		.addColumn("search_vector", sql`tsvector`)
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();

	// ── tori_item_image ──────────────────────────────────────────────────────────
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

	// ── Indexes ──────────────────────────────────────────────────────────────────
	await db.schema.createIndex("tori_item_owner_idx").on("tori_item").column("owner_id").execute();
	await db.schema
		.createIndex("tori_item_category_status_idx")
		.on("tori_item")
		.columns(["category", "status"])
		.execute();
	await db.schema
		.createIndex("tori_item_status_created_idx")
		.on("tori_item")
		.columns(["status", "created_at"])
		.execute();
	await db.schema
		.createIndex("tori_item_image_item_idx")
		.on("tori_item_image")
		.column("item_id")
		.execute();
	await sql`CREATE INDEX tori_item_search_gin ON tori_item USING gin(search_vector)`.execute(db);

	// ── FTS trigger ──────────────────────────────────────────────────────────────
	// Weights: title=A, description=B, city+region=C
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

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TRIGGER IF EXISTS tori_item_fts_trigger ON tori_item`.execute(db);
	await sql`DROP FUNCTION IF EXISTS tori_item_fts_update`.execute(db);
	await db.schema.dropTable("tori_item_image").execute();
	await db.schema.dropTable("tori_item").execute();
}
