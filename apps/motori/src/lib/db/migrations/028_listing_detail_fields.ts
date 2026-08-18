// Migration 028: Listing detail fields decided in #166
// - listing_sale: color, owner_count, power_kw, trade_possible
// - listing_gear: brand; size normalized to the fixed enum (XS…XXL, muu), unparseable → null
// - listing_part: oem_number
// - FTS trigger gains gear brand + part oem_number via subselects, and is restored to
//   finnish_unaccent (migration 010 accidentally regressed it to plain finnish while the
//   query side kept finnish_unaccent, so diacritic-insensitive matching was broken).
//   Child-table triggers poke the parent listing row so brand/oem edits refresh the vector.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("listing_sale")
		.addColumn("color", "text")
		.addColumn("owner_count", "integer")
		.addColumn("power_kw", "integer")
		.addColumn("trade_possible", "boolean", (col) => col.notNull().defaultTo(false))
		.execute();

	await db.schema.alterTable("listing_gear").addColumn("brand", "text").execute();

	await sql`
		UPDATE listing_gear SET size = CASE
			WHEN upper(trim(size)) IN ('XS', 'S', 'M', 'L', 'XL', 'XXL') THEN upper(trim(size))
			WHEN lower(trim(size)) = 'muu' THEN 'muu'
			ELSE NULL
		END
	`.execute(db);

	await db.schema.alterTable("listing_part").addColumn("oem_number", "text").execute();

	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish_unaccent', coalesce((SELECT name FROM motorcycle_make WHERE id = NEW.make_id), '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce((SELECT name FROM motorcycle_model WHERE id = NEW.model_id), '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce((SELECT brand FROM listing_gear WHERE listing_id = NEW.id), '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce((SELECT oem_number FROM listing_part WHERE listing_id = NEW.id), '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	// A no-op parent update fires the BEFORE UPDATE trigger above, recomputing the vector
	// with the child row now present (child rows are inserted after the listing row).
	await sql`
		CREATE OR REPLACE FUNCTION listing_child_fts_refresh() RETURNS trigger AS $$
		BEGIN
			UPDATE listing SET updated_at = updated_at WHERE id = NEW.listing_id;
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await sql`
		CREATE TRIGGER listing_gear_fts_refresh
			AFTER INSERT OR UPDATE OF brand ON listing_gear
			FOR EACH ROW EXECUTE FUNCTION listing_child_fts_refresh()
	`.execute(db);

	await sql`
		CREATE TRIGGER listing_part_fts_refresh
			AFTER INSERT OR UPDATE OF oem_number ON listing_part
			FOR EACH ROW EXECUTE FUNCTION listing_child_fts_refresh()
	`.execute(db);

	// Recompute every vector under the corrected config (same pattern as migration 004).
	await sql`UPDATE listing SET search_vector = NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TRIGGER IF EXISTS listing_part_fts_refresh ON listing_part`.execute(db);
	await sql`DROP TRIGGER IF EXISTS listing_gear_fts_refresh ON listing_gear`.execute(db);
	await sql`DROP FUNCTION IF EXISTS listing_child_fts_refresh`.execute(db);

	// Restore the migration-010 trigger (plain finnish, no child-table fields).
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish', coalesce((SELECT name FROM motorcycle_make WHERE id = NEW.make_id), '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce((SELECT name FROM motorcycle_model WHERE id = NEW.model_id), '')), 'B') ||
				setweight(to_tsvector('finnish', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await sql`UPDATE listing SET search_vector = NULL`.execute(db);

	await db.schema.alterTable("listing_part").dropColumn("oem_number").execute();
	// Gear sizes normalized in up() are not restored — the original free text is gone.
	await db.schema.alterTable("listing_gear").dropColumn("brand").execute();
	await db.schema
		.alterTable("listing_sale")
		.dropColumn("color")
		.dropColumn("owner_count")
		.dropColumn("power_kw")
		.dropColumn("trade_possible")
		.execute();
}
