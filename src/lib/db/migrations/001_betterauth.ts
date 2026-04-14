// src/lib/db/migrations/001_betterauth.ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// "user" is a reserved word in PostgreSQL — must be quoted
	await db.schema
		.createTable("user")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("email", "text", (col) => col.notNull().unique())
		.addColumn("emailVerified", "boolean", (col) =>
			col.notNull().defaultTo(false),
		)
		.addColumn("image", "text")
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("session")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("expiresAt", "timestamptz", (col) => col.notNull())
		.addColumn("token", "text", (col) => col.notNull().unique())
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.addColumn("ipAddress", "text")
		.addColumn("userAgent", "text")
		.addColumn("userId", "text", (col) =>
			col.notNull().references("user.id").onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("account")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("accountId", "text", (col) => col.notNull())
		.addColumn("providerId", "text", (col) => col.notNull())
		.addColumn("userId", "text", (col) =>
			col.notNull().references("user.id").onDelete("cascade"),
		)
		.addColumn("accessToken", "text")
		.addColumn("refreshToken", "text")
		.addColumn("idToken", "text")
		.addColumn("accessTokenExpiresAt", "timestamptz")
		.addColumn("refreshTokenExpiresAt", "timestamptz")
		.addColumn("scope", "text")
		.addColumn("password", "text")
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("verification")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("identifier", "text", (col) => col.notNull())
		.addColumn("value", "text", (col) => col.notNull())
		.addColumn("expiresAt", "timestamptz", (col) => col.notNull())
		// createdAt/updatedAt intentionally nullable — BetterAuth may omit them
		.addColumn("createdAt", "timestamptz")
		.addColumn("updatedAt", "timestamptz")
		.execute();

	// PostgreSQL does not auto-create indexes for FK columns (unlike MySQL)
	await db.schema
		.createIndex("session_user_id_idx")
		.on("session")
		.column("userId")
		.execute();

	await db.schema
		.createIndex("account_user_id_idx")
		.on("account")
		.column("userId")
		.execute();

	await db.schema
		.createIndex("verification_identifier_idx")
		.on("verification")
		.column("identifier")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("verification").execute();
	await db.schema.dropTable("account").execute();
	await db.schema.dropTable("session").execute();
	await db.schema.dropTable("user").execute();
}
