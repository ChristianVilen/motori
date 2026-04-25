import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("motorcycle_make")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("slug", "text", (col) => col.notNull())
		.addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
		.execute();

	await db.schema
		.createIndex("motorcycle_make_slug_idx")
		.on("motorcycle_make")
		.column("slug")
		.unique()
		.execute();

	await db.schema
		.createTable("motorcycle_model")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("make_id", "text", (col) =>
			col.notNull().references("motorcycle_make.id").onDelete("cascade"),
		)
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("approved", "boolean", (col) => col.notNull().defaultTo(true))
		.execute();

	await db.schema
		.createIndex("motorcycle_model_make_idx")
		.on("motorcycle_model")
		.column("make_id")
		.execute();

	// Add FK columns before dropping text columns so PG doesn't reject the table state
	await db.schema
		.alterTable("listing")
		.addColumn("make_id", "text", (col) => col.references("motorcycle_make.id"))
		.addColumn("model_id", "text", (col) => col.references("motorcycle_model.id"))
		.execute();

	await db.schema.alterTable("listing").dropColumn("brand").dropColumn("model").execute();

	// Update FTS trigger to read make/model names via subselects
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE OR REPLACE FUNCTION listing_fts_update() RETURNS trigger AS $$
		BEGIN
			NEW.search_vector :=
				setweight(to_tsvector('finnish', coalesce(NEW.title, '')), 'A') ||
				setweight(to_tsvector('finnish', coalesce(NEW.description, '')), 'C') ||
				setweight(to_tsvector('finnish', coalesce(NEW.city, '')), 'D') ||
				setweight(to_tsvector('finnish', coalesce(NEW.region, '')), 'D');
			RETURN NEW;
		END
		$$ LANGUAGE plpgsql
	`.execute(db);

	await db.schema
		.alterTable("listing")
		.dropColumn("make_id")
		.dropColumn("model_id")
		.addColumn("brand", "text", (col) => col.notNull().defaultTo(""))
		.addColumn("model", "text", (col) => col.notNull().defaultTo(""))
		.execute();

	await db.schema.dropTable("motorcycle_model").execute();
	await db.schema.dropTable("motorcycle_make").execute();
}
