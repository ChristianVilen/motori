import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE conversation (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			listing_id text NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			buyer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			seller_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			last_message_at timestamptz NOT NULL DEFAULT now(),
			buyer_last_read_at timestamptz,
			seller_last_read_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT conversation_buyer_not_seller CHECK (buyer_id <> seller_id),
			CONSTRAINT conversation_listing_buyer_unique UNIQUE (listing_id, buyer_id)
		)
	`.execute(db);

	await sql`CREATE INDEX conversation_buyer_recent_idx ON conversation(buyer_id, last_message_at DESC)`.execute(db);
	await sql`CREATE INDEX conversation_seller_recent_idx ON conversation(seller_id, last_message_at DESC)`.execute(db);

	await sql`
		CREATE TABLE message (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			conversation_id uuid NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
			sender_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			kind varchar(20) NOT NULL DEFAULT 'text',
			body text NOT NULL,
			booking_id uuid REFERENCES booking(id) ON DELETE SET NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT message_kind_check CHECK (kind IN ('text','booking_request')),
			CONSTRAINT message_body_length CHECK (char_length(body) BETWEEN 1 AND 4000)
		)
	`.execute(db);

	await sql`CREATE INDEX message_conversation_created_idx ON message(conversation_id, created_at)`.execute(db);

	await sql`
		CREATE TABLE user_block (
			blocker_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			blocked_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			created_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (blocker_id, blocked_id),
			CONSTRAINT user_block_not_self CHECK (blocker_id <> blocked_id)
		)
	`.execute(db);
	await sql`CREATE INDEX user_block_blocked_blocker_idx ON user_block(blocked_id, blocker_id)`.execute(db);

	await sql`ALTER TABLE booking ADD COLUMN conversation_id uuid REFERENCES conversation(id) ON DELETE SET NULL`.execute(db);
	await sql`ALTER TABLE booking ALTER COLUMN message DROP NOT NULL`.execute(db);
	await sql`CREATE INDEX booking_conversation_id_idx ON booking(conversation_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP INDEX IF EXISTS booking_conversation_id_idx`.execute(db);
	await sql`ALTER TABLE booking ALTER COLUMN message SET NOT NULL`.execute(db);
	await sql`ALTER TABLE booking DROP COLUMN conversation_id`.execute(db);
	await sql`DROP TABLE user_block`.execute(db);
	await sql`DROP TABLE message`.execute(db);
	await sql`DROP TABLE conversation`.execute(db);
}
