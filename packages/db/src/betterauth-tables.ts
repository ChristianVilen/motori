import type { ColumnType, Generated } from "kysely";

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
