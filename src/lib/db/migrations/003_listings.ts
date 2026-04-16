// src/lib/db/migrations/003_listings.ts
//
// Creates: listing, listing_image, favorite tables.
// Full-text search (Finnish config) is maintained by a BEFORE INSERT/UPDATE trigger
// so search_vector stays in sync automatically without application code.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// ── listing ─────────────────────────────────────────────────────────────────
	await db.schema
		.createTable("listing")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("owner_id", "text", (col) =>
			col.notNull().references("user.id").onDelete("cascade"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("brand", "text", (col) => col.notNull())
		.addColumn("model", "text", (col) => col.notNull())
		.addColumn("year", "integer", (col) => col.notNull())
		.addColumn("engine_cc", "integer")
		.addColumn("required_license", "text") // 'A1' | 'A2' | 'A'
		.addColumn("motorcycle_type", "text", (col) => col.notNull())
		.addColumn("price_per_day", "integer", (col) => col.notNull()) // EUR cents
		.addColumn("price_per_week", "integer") // EUR cents
		.addColumn("price_description", "text")
		.addColumn("deposit_amount", "integer") // EUR cents
		.addColumn("city", "text", (col) => col.notNull())
		.addColumn("region", "text", (col) => col.notNull())
		.addColumn("postal_code", "text")
		.addColumn("available_from", "date")
		.addColumn("available_to", "date")
		.addColumn("season_only", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("includes_helmet", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("includes_insurance", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("insurance_info", "text")
		.addColumn("mileage_limit", "integer") // km/day
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active")) // active|paused|rented|removed
		.addColumn("view_count", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("expires_at", "timestamptz")
		.addColumn("search_vector", sql`tsvector`) // maintained by trigger below
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();

	// ── listing_image ────────────────────────────────────────────────────────────
	await db.schema
		.createTable("listing_image")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("listing_id", "text", (col) =>
			col.notNull().references("listing.id").onDelete("cascade"),
		)
		.addColumn("url", "text", (col) => col.notNull())
		.addColumn("thumbnail_url", "text")
		.addColumn("order", "integer", (col) => col.notNull().defaultTo(0))
		.execute();

	// ── favorite ─────────────────────────────────────────────────────────────────
	await db.schema
		.createTable("favorite")
		.addColumn("user_id", "text", (col) =>
			col.notNull().references("user.id").onDelete("cascade"),
		)
		.addColumn("listing_id", "text", (col) =>
			col.notNull().references("listing.id").onDelete("cascade"),
		)
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.addPrimaryKeyConstraint("favorite_pk", ["user_id", "listing_id"])
		.execute();

	// ── Indexes ──────────────────────────────────────────────────────────────────
	await db.schema.createIndex("listing_owner_idx").on("listing").column("owner_id").execute();
	await db.schema
		.createIndex("listing_region_status_idx")
		.on("listing")
		.columns(["region", "status"])
		.execute();
	await db.schema
		.createIndex("listing_type_status_idx")
		.on("listing")
		.columns(["motorcycle_type", "status"])
		.execute();
	await db.schema
		.createIndex("listing_license_status_idx")
		.on("listing")
		.columns(["required_license", "status"])
		.execute();
	await db.schema
		.createIndex("listing_image_listing_idx")
		.on("listing_image")
		.column("listing_id")
		.execute();

	// GIN index for full-text search
	await sql`CREATE INDEX listing_search_gin ON listing USING gin(search_vector)`.execute(db);

	// ── FTS trigger ──────────────────────────────────────────────────────────────
	// Weights: title=A, brand+model=B, description=C, city+region=D
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish', coalesce(NEW.brand, '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce(NEW.model, '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await sql`
		CREATE TRIGGER listing_fts_trigger
			BEFORE INSERT OR UPDATE ON listing
			FOR EACH ROW EXECUTE FUNCTION listing_fts_update()
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TRIGGER IF EXISTS listing_fts_trigger ON listing`.execute(db);
	await sql`DROP FUNCTION IF EXISTS listing_fts_update`.execute(db);
	await db.schema.dropTable("favorite").execute();
	await db.schema.dropTable("listing_image").execute();
	await db.schema.dropTable("listing").execute();
}
