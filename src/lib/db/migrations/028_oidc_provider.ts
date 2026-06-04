import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("oauthApplication")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("icon", "text")
		.addColumn("metadata", "text")
		.addColumn("clientId", "text", (col) => col.notNull().unique())
		.addColumn("clientSecret", "text")
		.addColumn("redirectUrls", "text", (col) => col.notNull())
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("disabled", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("userId", "text", (col) => col.references("user.id").onDelete("cascade"))
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("oauthAccessToken")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("accessToken", "text", (col) => col.unique())
		.addColumn("refreshToken", "text", (col) => col.unique())
		.addColumn("accessTokenExpiresAt", "timestamptz")
		.addColumn("refreshTokenExpiresAt", "timestamptz")
		// clientId has no FK: trusted clients live in config, not this table.
		.addColumn("clientId", "text")
		.addColumn("userId", "text", (col) => col.references("user.id").onDelete("cascade"))
		.addColumn("scopes", "text")
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("oauthConsent")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("clientId", "text")
		.addColumn("userId", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
		.addColumn("scopes", "text")
		.addColumn("consentGiven", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("oauth_access_token_user_id_idx")
		.on("oauthAccessToken")
		.column("userId")
		.execute();
	await db.schema
		.createIndex("oauth_access_token_client_id_idx")
		.on("oauthAccessToken")
		.column("clientId")
		.execute();
	await db.schema
		.createIndex("oauth_consent_user_id_idx")
		.on("oauthConsent")
		.column("userId")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("oauthConsent").execute();
	await db.schema.dropTable("oauthAccessToken").execute();
	await db.schema.dropTable("oauthApplication").execute();
}
