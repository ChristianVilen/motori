import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// Drop old oidcProvider tables (order matters — foreign keys).
	await db.schema.dropTable("oauthConsent").ifExists().execute();
	await db.schema.dropTable("oauthAccessToken").ifExists().execute();
	await db.schema.dropTable("oauthApplication").ifExists().execute();

	await db.schema
		.createTable("oauthClient")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("clientId", "text", (col) => col.notNull().unique())
		.addColumn("clientSecret", "text")
		.addColumn("disabled", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("skipConsent", "boolean")
		.addColumn("enableEndSession", "boolean")
		.addColumn("subjectType", "text")
		.addColumn("scopes", sql`text[]`)
		.addColumn("userId", "text", (col) => col.references("user.id"))
		.addColumn("createdAt", "timestamptz")
		.addColumn("updatedAt", "timestamptz")
		.addColumn("name", "text")
		.addColumn("uri", "text")
		.addColumn("icon", "text")
		.addColumn("contacts", sql`text[]`)
		.addColumn("tos", "text")
		.addColumn("policy", "text")
		.addColumn("softwareId", "text")
		.addColumn("softwareVersion", "text")
		.addColumn("softwareStatement", "text")
		.addColumn("redirectUris", sql`text[]`, (col) => col.notNull())
		.addColumn("postLogoutRedirectUris", sql`text[]`)
		.addColumn("tokenEndpointAuthMethod", "text")
		.addColumn("grantTypes", sql`text[]`)
		.addColumn("responseTypes", sql`text[]`)
		.addColumn("public", "boolean")
		.addColumn("type", "text")
		.addColumn("requirePKCE", "boolean")
		.addColumn("referenceId", "text")
		.addColumn("metadata", "jsonb")
		.execute();

	await db.schema
		.createTable("oauthRefreshToken")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("token", "text", (col) => col.notNull().unique())
		.addColumn("clientId", "text", (col) => col.notNull().references("oauthClient.clientId"))
		.addColumn("sessionId", "text", (col) => col.references("session.id"))
		.addColumn("userId", "text", (col) => col.notNull().references("user.id"))
		.addColumn("referenceId", "text")
		.addColumn("expiresAt", "timestamptz", (col) => col.notNull())
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("revoked", "timestamptz")
		.addColumn("authTime", "timestamptz")
		.addColumn("scopes", sql`text[]`, (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("oauthAccessToken")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("token", "text", (col) => col.unique())
		.addColumn("clientId", "text", (col) => col.notNull().references("oauthClient.clientId"))
		.addColumn("sessionId", "text", (col) => col.references("session.id"))
		.addColumn("userId", "text", (col) => col.references("user.id"))
		.addColumn("referenceId", "text")
		.addColumn("refreshId", "text", (col) => col.references("oauthRefreshToken.id"))
		.addColumn("expiresAt", "timestamptz", (col) => col.notNull())
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("scopes", sql`text[]`, (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("oauthConsent")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("clientId", "text", (col) => col.notNull().references("oauthClient.clientId"))
		.addColumn("userId", "text", (col) => col.references("user.id"))
		.addColumn("referenceId", "text")
		.addColumn("scopes", sql`text[]`, (col) => col.notNull())
		.addColumn("createdAt", "timestamptz", (col) => col.notNull())
		.addColumn("updatedAt", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("oauth_client_user_id_idx")
		.on("oauthClient")
		.column("userId")
		.execute();
	await db.schema
		.createIndex("oauth_refresh_token_client_id_idx")
		.on("oauthRefreshToken")
		.column("clientId")
		.execute();
	await db.schema
		.createIndex("oauth_refresh_token_session_id_idx")
		.on("oauthRefreshToken")
		.column("sessionId")
		.execute();
	await db.schema
		.createIndex("oauth_refresh_token_user_id_idx")
		.on("oauthRefreshToken")
		.column("userId")
		.execute();
	await db.schema
		.createIndex("oauth_access_token_client_id_idx")
		.on("oauthAccessToken")
		.column("clientId")
		.execute();
	await db.schema
		.createIndex("oauth_access_token_session_id_idx")
		.on("oauthAccessToken")
		.column("sessionId")
		.execute();
	await db.schema
		.createIndex("oauth_access_token_user_id_idx")
		.on("oauthAccessToken")
		.column("userId")
		.execute();
	await db.schema
		.createIndex("oauth_access_token_refresh_id_idx")
		.on("oauthAccessToken")
		.column("refreshId")
		.execute();
	await db.schema
		.createIndex("oauth_consent_client_id_idx")
		.on("oauthConsent")
		.column("clientId")
		.execute();
	await db.schema
		.createIndex("oauth_consent_user_id_idx")
		.on("oauthConsent")
		.column("userId")
		.execute();

	// Seed the Grafana OIDC client. Secret is stored plain — the plugin is configured with a
	// plain-text storeClientSecret verifier in auth.ts. If GRAFANA_OIDC_SECRET changes,
	// update the row: UPDATE "oauthClient" SET "clientSecret"='<new>' WHERE "clientId"='grafana'.
	const secret = process.env.GRAFANA_OIDC_SECRET;
	if (secret) {
		const now = new Date();
		// biome-ignore lint/suspicious/noExplicitAny: Kysely<unknown> requires any for DML
		await (db as any)
			.insertInto("oauthClient")
			.values({
				id: crypto.randomUUID(),
				clientId: "grafana",
				clientSecret: secret,
				name: "Grafana",
				type: "web",
				redirectUris: [
					"http://localhost:3001/login/generic_oauth",
					"https://grafana.motori.fi/login/generic_oauth",
				],
				skipConsent: true,
				disabled: false,
				createdAt: now,
				updatedAt: now,
			})
			.execute();
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("oauthConsent").execute();
	await db.schema.dropTable("oauthAccessToken").execute();
	await db.schema.dropTable("oauthRefreshToken").execute();
	await db.schema.dropTable("oauthClient").execute();
}
