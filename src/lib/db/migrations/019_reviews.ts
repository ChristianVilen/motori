import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE review (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			booking_id uuid NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
			reviewer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			target_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			rating integer NOT NULL,
			comment text,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT review_booking_reviewer_unique UNIQUE (booking_id, reviewer_id),
			CONSTRAINT review_rating_check CHECK (rating BETWEEN 1 AND 5),
			CONSTRAINT review_no_self_review CHECK (reviewer_id != target_user_id)
		)
	`.execute(db);

	await sql`CREATE INDEX review_target_user_id_idx ON review(target_user_id)`.execute(db);
	await sql`CREATE INDEX review_booking_id_idx ON review(booking_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE review`.execute(db);
}
