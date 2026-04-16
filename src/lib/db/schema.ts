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

// ─── Database interface ───────────────────────────────────────────────────────

export interface Database {
	user: UserTable;
	session: SessionTable;
	account: AccountTable;
	verification: VerificationTable;
	profile: ProfileTable;
}
