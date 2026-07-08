import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// Per-listing default availability mode. 'open' = all dates available unless
	// explicitly blocked or booked; 'closed' = all dates blocked unless explicitly opened.
	await sql`
		ALTER TABLE listing
		ADD COLUMN availability_default varchar(8) NOT NULL DEFAULT 'open'
	`.execute(db);
	await sql`
		ALTER TABLE listing
		ADD CONSTRAINT listing_availability_default_check
		CHECK (availability_default IN ('open','closed'))
	`.execute(db);

	// Owner-set exception dates. Semantics depend on listing.availability_default:
	// default='open' → these dates are blocked; default='closed' → these dates are opened.
	await sql`
		CREATE TABLE listing_availability_exception (
			listing_id text NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			date date NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (listing_id, date)
		)
	`.execute(db);

	// Booking requests.
	await sql`
		CREATE TABLE booking (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			short_id varchar(8) NOT NULL UNIQUE,
			listing_id text NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			renter_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			start_date date NOT NULL,
			end_date date NOT NULL,
			message text NOT NULL,
			status varchar(16) NOT NULL DEFAULT 'pending',
			rejection_reason text,
			responded_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT booking_status_check CHECK (status IN ('pending','confirmed','rejected','expired','cancelled')),
			CONSTRAINT booking_dates_check CHECK (end_date >= start_date)
		)
	`.execute(db);

	await sql`CREATE INDEX booking_listing_id_idx ON booking(listing_id)`.execute(db);
	await sql`CREATE INDEX booking_renter_user_id_idx ON booking(renter_user_id)`.execute(db);
	await sql`CREATE INDEX booking_listing_status_idx ON booking(listing_id, status)`.execute(db);
	// Used by the stale-expiry cron query.
	await sql`CREATE INDEX booking_status_created_idx ON booking(status, created_at) WHERE status = 'pending'`.execute(
		db,
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE booking`.execute(db);
	await sql`DROP TABLE listing_availability_exception`.execute(db);
	await sql`ALTER TABLE listing DROP CONSTRAINT listing_availability_default_check`.execute(db);
	await sql`ALTER TABLE listing DROP COLUMN availability_default`.execute(db);
}
