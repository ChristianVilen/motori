import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./schema";

const dialect = new PostgresDialect({
	pool: new pg.Pool({
		connectionString: process.env.DATABASE_URL,
		max: 20,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 5_000,
	}),
});

export const db = new Kysely<Database>({ dialect });
