import { type Kysely, sql } from "kysely";

// Payment reminders (tax/insurance) recur on annual MM-DD anchors the user
// defines. Non-null recurrence_dates marks a payment reminder; due_date stays
// the active/next absolute date that drives due-state and the digest.
export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE talli.reminder ADD COLUMN recurrence_dates text[]`.execute(db);
	await sql`
		ALTER TABLE talli.reminder
		ADD CONSTRAINT reminder_recurrence_check
		CHECK (recurrence_dates IS NULL OR type = 'date')
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE talli.reminder DROP COLUMN recurrence_dates`.execute(db);
}
