import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

// ─── BetterAuth tables ────────────────────────────────────────────────────────
// Column names are camelCase — BetterAuth's externally-dictated convention.
// Timestamps typed as ColumnType<Date, Date, Date> — the pg driver serialises
// JS Date objects correctly; accepting raw strings would remove type safety.

export interface UserTable {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	role: Generated<string>;
	banned: Generated<boolean>;
	banReason: string | null;
	banExpires: ColumnType<Date, Date, Date> | null;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
}

export interface SessionTable {
	id: string;
	expiresAt: ColumnType<Date, Date, Date>;
	token: string;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
	ipAddress: string | null;
	userAgent: string | null;
	userId: string;
	impersonatedBy: string | null;
}

export interface AccountTable {
	id: string;
	accountId: string;
	providerId: string;
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	accessTokenExpiresAt: ColumnType<Date, Date, Date> | null;
	refreshTokenExpiresAt: ColumnType<Date, Date, Date> | null;
	scope: string | null;
	password: string | null;
	createdAt: ColumnType<Date, Date, Date>;
	updatedAt: ColumnType<Date, Date, Date>;
}

export interface VerificationTable {
	id: string;
	identifier: string;
	value: string;
	expiresAt: ColumnType<Date, Date, Date>;
	createdAt: ColumnType<Date, Date, Date> | null;
	updatedAt: ColumnType<Date, Date, Date> | null;
}

export type DbUser = Selectable<UserTable>;
export type DbSession = Selectable<SessionTable>;
export type DbAccount = Selectable<AccountTable>;
export type DbVerification = Selectable<VerificationTable>;

// ─── App tables ───────────────────────────────────────────────────────────────
// Column names are snake_case — idiomatic PostgreSQL for app-owned tables.
// updated_at: defaultTo(now()) fires only on INSERT. Every UPDATE query must
// explicitly set updated_at = new Date() in application code.

export interface ProfileTable {
	user_id: string;
	display_name: string;
	city: string | null;
	phone: string | null;
	show_phone: Generated<boolean>; // DB default false — omit on insert to use default
	license_class: "A1" | "A2" | "A" | null;
	language: "fi" | "en";
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Profile = Selectable<ProfileTable>;
export type NewProfile = Insertable<ProfileTable>;
export type ProfileUpdate = Updateable<ProfileTable>;

export interface MotorcycleMakeTable {
	id: string;
	name: string;
	slug: string;
	approved: Generated<boolean>;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface MotorcycleModelTable {
	id: string;
	make_id: string;
	name: string;
	approved: Generated<boolean>;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type MotorcycleMake = Selectable<MotorcycleMakeTable>;
export type MotorcycleModel = Selectable<MotorcycleModelTable>;

export interface ListingTable {
	id: string;
	owner_id: string;
	title: string;
	make_id: string;
	model_id: string | null;
	year: number;
	engine_cc: number | null;
	required_license: "A1" | "A2" | "A" | null;
	motorcycle_type: string;
	price_per_day: number; // EUR cents
	price_per_week: number | null; // EUR cents
	price_description: string | null;
	city: string;
	region: string;
	postal_code: string | null;
	description: string;
	mileage_limit: number | null; // km/day
	status: Generated<"active" | "paused" | "rented" | "removed">;
	view_count: Generated<number>;
	expires_at: ColumnType<Date, Date | undefined, Date> | null;
	expiry_notified_at: ColumnType<Date, Date | undefined, Date> | null;
	search_vector: Generated<string>; // tsvector, maintained by trigger
	reviewed_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Listing = Selectable<ListingTable>;
export type NewListing = Insertable<ListingTable>;
export type ListingUpdate = Updateable<ListingTable>;

export interface ListingImageTable {
	id: string;
	listing_id: string;
	url: string;
	thumbnail_url: string | null;
	order: Generated<number>;
}

export type ListingImage = Selectable<ListingImageTable>;
export type NewListingImage = Insertable<ListingImageTable>;

export interface FavoriteTable {
	user_id: string;
	listing_id: string;
	created_at: ColumnType<Date, Date | undefined, never>;
}

export type Favorite = Selectable<FavoriteTable>;

export interface ReportTable {
	id: string;
	reporter_id: string;
	target_type: "listing" | "user";
	target_id: string;
	reason: string;
	status: Generated<"pending" | "resolved" | "dismissed">;
	admin_note: string | null;
	resolved_by: string | null;
	resolved_at: ColumnType<Date, Date, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type Report = Selectable<ReportTable>;
export type NewReport = Insertable<ReportTable>;

// ─── Database interface ───────────────────────────────────────────────────────

export interface Database {
	user: UserTable;
	session: SessionTable;
	account: AccountTable;
	verification: VerificationTable;
	profile: ProfileTable;
	motorcycle_make: MotorcycleMakeTable;
	motorcycle_model: MotorcycleModelTable;
	listing: ListingTable;
	listing_image: ListingImageTable;
	favorite: FavoriteTable;
	report: ReportTable;
}
