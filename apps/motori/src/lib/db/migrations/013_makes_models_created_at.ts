import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("motorcycle_make")
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();
	await db.schema
		.alterTable("motorcycle_model")
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("motorcycle_make").dropColumn("created_at").execute();
	await db.schema.alterTable("motorcycle_model").dropColumn("created_at").execute();
}
