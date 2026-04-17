// src/lib/db/migrations/004_search_extensions.ts
//
// Adds unaccent + pg_trgm and a `finnish_unaccent` text search configuration
// that strips diacritics before Finnish stemming. This makes FTS tolerant to
// users typing "jyvaskyla" for "Jyväskylä", "aani" for "ääni", etc.
//
// pg_trgm is enabled here so similarity()/% are available for future fuzzy
// matching (typo tolerance, "did you mean"). No trigram indexes are added yet —
// they have real write cost, so we wait until a query actually uses them.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`CREATE EXTENSION IF NOT EXISTS unaccent`.execute(db);
	await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

	// Text search config: unaccent → finnish_stem.
	// Applied to both indexed tsvectors and to_tsquery() calls, so matches are
	// symmetric regardless of whether input has diacritics.
	await sql`CREATE TEXT SEARCH CONFIGURATION finnish_unaccent (COPY = finnish)`.execute(db);
	await sql`
		ALTER TEXT SEARCH CONFIGURATION finnish_unaccent
		ALTER MAPPING FOR hword, hword_part, word
		WITH unaccent, finnish_stem
	`.execute(db);

	// Swap the trigger to use the new config.
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.brand, '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.model, '')), 'B') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish_unaccent', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	// Backfill existing rows: no-op UPDATE fires the BEFORE UPDATE trigger,
	// which recomputes search_vector under the new config.
	await sql`UPDATE listing SET search_vector = NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Restore the original Finnish-only trigger.
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

	await sql`UPDATE listing SET search_vector = NULL`.execute(db);

	await sql`DROP TEXT SEARCH CONFIGURATION IF EXISTS finnish_unaccent`.execute(db);
	await sql`DROP EXTENSION IF EXISTS pg_trgm`.execute(db);
	await sql`DROP EXTENSION IF EXISTS unaccent`.execute(db);
}
