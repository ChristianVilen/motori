// src/lib/db/migrations/002_profile.ts
//
// Convention: app-owned tables use snake_case columns.
// BetterAuth tables (001_betterauth) keep BetterAuth's camelCase — that is externally dictated.
//
// updated_at: defaultTo(now()) fires only on INSERT. Every UPDATE query against this
// table must explicitly set updated_at = new Date() in application code.
import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("profile")
		.addColumn("user_id", "text", (col) =>
			col.primaryKey().references("user.id").onDelete("cascade"),
		)
		.addColumn("display_name", "text", (col) => col.notNull())
		.addColumn("city", "text")
		.addColumn("phone", "text")
		.addColumn("show_phone", "boolean", (col) =>
			col.notNull().defaultTo(false),
		)
		.addColumn("license_class", "text") // 'A1' | 'A2' | 'A'
		.addColumn("language", "text", (col) => col.notNull().defaultTo("fi"))
		.addColumn("created_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.addColumn("updated_at", "timestamptz", (col) =>
			col.notNull().defaultTo(sql`now()`),
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("profile").execute();
}
