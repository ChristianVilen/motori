import type { AccountTable, SessionTable, UserTable, VerificationTable } from "@motori/db";
import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type { AccountTable, SessionTable, UserTable, VerificationTable };

// ─── talli schema tables ──────────────────────────────────────────────────────
// talli owns ONLY the `talli` Postgres schema. BetterAuth tables (public) are
// reachable read-only for joins; never migrate or mutate them from this app.
// snake_case columns. updated_at DB default fires only on INSERT — every UPDATE
// must set updated_at: new Date() explicitly.
// `date` columns are string YYYY-MM-DD on the wire — cast with sql<string>`col::text`
// when selecting (pg would otherwise return a TZ-ambiguous Date).

export interface VehicleTable {
	id: Generated<string>;
	user_id: string;
	vehicle_type: Generated<string>; // 'motorcycle' — cars later (issue #134)
	make: string;
	model: string;
	year: number | null;
	nickname: string | null;
	plate: string | null;
	vin: string | null;
	photo_url: string | null;
	thumbnail_url: string | null;
	odometer_km: number;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Vehicle = Selectable<VehicleTable>;
export type NewVehicle = Insertable<VehicleTable>;
export type VehicleUpdate = Updateable<VehicleTable>;

export type ReminderType = "interval" | "date";

export interface ReminderTable {
	id: Generated<string>;
	vehicle_id: string;
	type: ReminderType;
	title: string;
	interval_km: number | null;
	interval_months: number | null;
	last_done_at: string | null; // date — anchor for interval reminders
	last_done_km: number | null;
	due_date: string | null; // date — active/next absolute due date
	// text[] of annual MM-DD anchors; non-null ⇒ payment reminder. Insert-optional (defaults NULL).
	recurrence_dates: ColumnType<string[] | null, string[] | null | undefined, string[] | null>;
	notified_at: Date | null; // dedupe: digest emails once per due cycle
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Reminder = Selectable<ReminderTable>;
export type NewReminder = Insertable<ReminderTable>;
export type ReminderUpdate = Updateable<ReminderTable>;

export interface ServiceRecordTable {
	id: Generated<string>;
	vehicle_id: string;
	reminder_id: string | null; // set when created by completing a reminder
	performed_at: string; // date
	odometer_km: number | null;
	title: string;
	notes: string | null;
	cost_cents: number | null; // parts + labor as one number in MVP
	parts: string | null; // free text in MVP; structured later (issue #133)
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type ServiceRecord = Selectable<ServiceRecordTable>;
export type NewServiceRecord = Insertable<ServiceRecordTable>;

export interface ServiceRecordPhotoTable {
	id: Generated<string>;
	service_record_id: string;
	url: string;
	thumbnail_url: string;
	position: number;
}

export type ServiceRecordPhoto = Selectable<ServiceRecordPhotoTable>;
export type NewServiceRecordPhoto = Insertable<ServiceRecordPhotoTable>;

export interface OdometerEntryTable {
	id: Generated<string>;
	vehicle_id: string;
	reading_km: number;
	recorded_at: ColumnType<Date, Date | undefined, Date>;
}

export type OdometerEntry = Selectable<OdometerEntryTable>;
export type NewOdometerEntry = Insertable<OdometerEntryTable>;

export interface UserSettingsTable {
	user_id: string;
	email_reminders: Generated<boolean>; // DB default true — omit on insert
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type UserSettings = Selectable<UserSettingsTable>;
export type NewUserSettings = Insertable<UserSettingsTable>;
export type UserSettingsUpdate = Updateable<UserSettingsTable>;

export type DocType = "rekisteriote" | "vakuutus" | "kuitti" | "takuu" | "muu";

export interface DocumentTable {
	id: Generated<string>;
	vehicle_id: string;
	name: string;
	doc_type: DocType;
	storage_key: string; // S3 object key — never a URL; served via /api/documents/$id
	mime_type: string;
	size_bytes: number;
	created_at: ColumnType<Date, Date | undefined, never>;
}

export type DocumentRow = Selectable<DocumentTable>;
export type NewDocument = Insertable<DocumentTable>;

// ─── Database interface ───────────────────────────────────────────────────────

export interface Database {
	user: UserTable;
	session: SessionTable;
	account: AccountTable;
	verification: VerificationTable;
	"talli.vehicle": VehicleTable;
	"talli.reminder": ReminderTable;
	"talli.service_record": ServiceRecordTable;
	"talli.service_record_photo": ServiceRecordPhotoTable;
	"talli.odometer_entry": OdometerEntryTable;
	"talli.user_settings": UserSettingsTable;
	"talli.document": DocumentTable;
}
