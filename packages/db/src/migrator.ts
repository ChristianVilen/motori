import { promises as fs } from "node:fs";
import path from "node:path";
import type { Kysely } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";

export function createMigrator(opts: {
	// biome-ignore lint/suspicious/noExplicitAny: Migrator is schema-agnostic
	db: Kysely<any>;
	migrationFolder: string;
	migrationTableSchema?: string;
}): Migrator {
	return new Migrator({
		db: opts.db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: opts.migrationFolder,
		}),
		...(opts.migrationTableSchema ? { migrationTableSchema: opts.migrationTableSchema } : {}),
	});
}
