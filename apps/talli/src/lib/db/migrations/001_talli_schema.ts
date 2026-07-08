import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// createMigrator({ migrationTableSchema: "talli" }) also creates the schema,
	// but be explicit — this migration must never touch public.
	await sql`CREATE SCHEMA IF NOT EXISTS talli`.execute(db);

	await sql`
		CREATE TABLE talli.vehicle (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
			vehicle_type text NOT NULL DEFAULT 'motorcycle',
			make text NOT NULL,
			model text NOT NULL,
			year integer,
			nickname text,
			plate text,
			vin text,
			photo_url text,
			thumbnail_url text,
			odometer_km integer NOT NULL DEFAULT 0,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
	await sql`CREATE INDEX vehicle_user_id_idx ON talli.vehicle(user_id)`.execute(db);

	await sql`
		CREATE TABLE talli.reminder (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			vehicle_id uuid NOT NULL REFERENCES talli.vehicle(id) ON DELETE CASCADE,
			type text NOT NULL,
			title text NOT NULL,
			interval_km integer,
			interval_months integer,
			last_done_at date,
			last_done_km integer,
			due_date date,
			notified_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT reminder_type_check CHECK (type IN ('interval','date')),
			CONSTRAINT reminder_interval_check CHECK (
				type <> 'interval' OR interval_km IS NOT NULL OR interval_months IS NOT NULL
			),
			CONSTRAINT reminder_date_check CHECK (type <> 'date' OR due_date IS NOT NULL)
		)
	`.execute(db);
	await sql`CREATE INDEX reminder_vehicle_id_idx ON talli.reminder(vehicle_id)`.execute(db);

	await sql`
		CREATE TABLE talli.service_record (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			vehicle_id uuid NOT NULL REFERENCES talli.vehicle(id) ON DELETE CASCADE,
			reminder_id uuid REFERENCES talli.reminder(id) ON DELETE SET NULL,
			performed_at date NOT NULL,
			odometer_km integer,
			title text NOT NULL,
			notes text,
			cost_cents integer,
			parts text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
	await sql`
		CREATE INDEX service_record_vehicle_performed_idx
		ON talli.service_record(vehicle_id, performed_at DESC)
	`.execute(db);

	await sql`
		CREATE TABLE talli.service_record_photo (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			service_record_id uuid NOT NULL REFERENCES talli.service_record(id) ON DELETE CASCADE,
			url text NOT NULL,
			thumbnail_url text NOT NULL,
			position integer NOT NULL
		)
	`.execute(db);
	await sql`
		CREATE INDEX service_record_photo_record_idx
		ON talli.service_record_photo(service_record_id)
	`.execute(db);

	await sql`
		CREATE TABLE talli.odometer_entry (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			vehicle_id uuid NOT NULL REFERENCES talli.vehicle(id) ON DELETE CASCADE,
			reading_km integer NOT NULL,
			recorded_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
	await sql`CREATE INDEX odometer_entry_vehicle_idx ON talli.odometer_entry(vehicle_id)`.execute(
		db,
	);

	await sql`
		CREATE TABLE talli.user_settings (
			user_id text PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
			email_reminders boolean NOT NULL DEFAULT true,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE talli.user_settings`.execute(db);
	await sql`DROP TABLE talli.odometer_entry`.execute(db);
	await sql`DROP TABLE talli.service_record_photo`.execute(db);
	await sql`DROP TABLE talli.service_record`.execute(db);
	await sql`DROP TABLE talli.reminder`.execute(db);
	await sql`DROP TABLE talli.vehicle`.execute(db);
}
