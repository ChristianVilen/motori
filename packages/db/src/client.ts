import { Kysely, PostgresDialect } from "kysely";

// pg uses Buffer (Node-only). Guard the import so this file is safe to
// evaluate in client bundles — the await import("pg") branch is dead code
// for browser builds (Rollup replaces typeof window with "object").
export async function createDb<DB>(): Promise<Kysely<DB>> {
	if (typeof window !== "undefined") {
		return null as unknown as Kysely<DB>;
	}
	const { default: pg } = await import("pg");
	return new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				connectionString: process.env.DATABASE_URL,
				max: 20,
				idleTimeoutMillis: 30_000,
				connectionTimeoutMillis: 5_000,
			}),
		}),
	});
}
