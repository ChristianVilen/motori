import type { ColumnType, Insertable, Selectable, Updateable } from "kysely";

// ─── BetterAuth tables ────────────────────────────────────────────────────────
// Column names are camelCase — BetterAuth's externally-dictated convention.

export interface UserTable {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	image: string | null;
	createdAt: ColumnType<Date, string | Date, string | Date>;
	updatedAt: ColumnType<Date, string | Date, string | Date>;
}

export interface SessionTable {
	id: string;
	expiresAt: ColumnType<Date, string | Date, string | Date>;
	token: string;
	createdAt: ColumnType<Date, string | Date, string | Date>;
	updatedAt: ColumnType<Date, string | Date, string | Date>;
	ipAddress: string | null;
	userAgent: string | null;
	userId: string;
}

export interface AccountTable {
	id: string;
	accountId: string;
	providerId: string;
	userId: string;
	accessToken: string | null;
	refreshToken: string | null;
	idToken: string | null;
	accessTokenExpiresAt: ColumnType<Date, string | Date, string | Date> | null;
	refreshTokenExpiresAt: ColumnType<Date, string | Date, string | Date> | null;
	scope: string | null;
	password: string | null;
	createdAt: ColumnType<Date, string | Date, string | Date>;
	updatedAt: ColumnType<Date, string | Date, string | Date>;
}

export interface VerificationTable {
	id: string;
	identifier: string;
	value: string;
	expiresAt: ColumnType<Date, string | Date, string | Date>;
	createdAt: ColumnType<Date, string | Date, string | Date> | null;
	updatedAt: ColumnType<Date, string | Date, string | Date> | null;
}

// ─── App tables ───────────────────────────────────────────────────────────────
// Column names are snake_case — idiomatic PostgreSQL for app-owned tables.

export interface ProfileTable {
	user_id: string;
	display_name: string;
	city: string | null;
	phone: string | null;
	show_phone: boolean;
	license_class: "A1" | "A2" | "A" | null;
	language: "fi" | "en";
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Profile = Selectable<ProfileTable>;
export type NewProfile = Insertable<ProfileTable>;
export type ProfileUpdate = Updateable<ProfileTable>;

// ─── Database interface ───────────────────────────────────────────────────────

export interface Database {
	user: UserTable;
	session: SessionTable;
	account: AccountTable;
	verification: VerificationTable;
	profile: ProfileTable;
}
