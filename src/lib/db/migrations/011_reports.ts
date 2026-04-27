import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("report")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("reporter_id", "text", (col) =>
			col.notNull().references("user.id").onDelete("cascade"),
		)
		.addColumn("target_type", "text", (col) => col.notNull()) // 'listing' | 'user'
		.addColumn("target_id", "text", (col) => col.notNull())
		.addColumn("reason", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending")) // pending | resolved | dismissed
		.addColumn("admin_note", "text")
		.addColumn("resolved_by", "text", (col) => col.references("user.id").onDelete("set null"))
		.addColumn("resolved_at", "timestamptz")
		.addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
		.addUniqueConstraint("report_unique_per_user", ["reporter_id", "target_type", "target_id"])
		.execute();

	await db.schema
		.createIndex("report_status_idx")
		.on("report")
		.columns(["status", "created_at"])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("report").execute();
}
