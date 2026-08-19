// Migration 030: saved_search table for bookmarks-only saved searches (#191)
// Bookmarks-only for the MVP slice: no alert emails, just a stored filter set a
// user can revisit from /omat/haut. params is the browse filter set minus the
// client-only/pagination fields (cursor, view, city) — see savedSearchParamsSchema.
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("saved_search")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("user_id", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
		.addColumn("category", "text", (col) => col.notNull())
		.addColumn("params", "jsonb", (col) => col.notNull())
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();

	await db.schema
		.createIndex("saved_search_user_idx")
		.on("saved_search")
		.column("user_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("saved_search").execute();
}
