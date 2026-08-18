// Migration 029: Tori-row cleanup decided in #170
// Old tori taxonomy values 'parts'/'tools' can't tell brakes from exhaust, so 'other'
// is the only honest mapping — owners refine to a real category on next edit.
// One-way: down is a no-op because the original values carry no information to restore.
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		UPDATE listing_part SET part_category = 'other'
		WHERE part_category IN ('parts', 'tools')
	`.execute(db);
}

export async function down(): Promise<void> {}
