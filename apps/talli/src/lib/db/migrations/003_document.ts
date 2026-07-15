import { type Kysely, sql } from "kysely";

// Documents store an S3 key, not a URL — the bucket is private and objects are
// only reachable via the authenticated /api/documents/$id proxy. Rows are
// immutable after creation (no rename in MVP), hence no updated_at.
export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE talli.document (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			vehicle_id uuid NOT NULL REFERENCES talli.vehicle(id) ON DELETE CASCADE,
			name text NOT NULL,
			doc_type text NOT NULL,
			storage_key text NOT NULL,
			mime_type text NOT NULL,
			size_bytes integer NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT document_type_check CHECK (
				doc_type IN ('rekisteriote', 'vakuutus', 'kuitti', 'takuu', 'muu')
			)
		)
	`.execute(db);
	await sql`CREATE INDEX document_vehicle_id_idx ON talli.document(vehicle_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE talli.document`.execute(db);
}
