// biome-ignore-all lint/suspicious/noConsole: CLI script — console output is expected
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely";
import { db } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrator = new Migrator({
	db,
	provider: new FileMigrationProvider({
		fs,
		path,
		migrationFolder: path.join(__dirname, "migrations"),
	}),
});

const { error, results } = await migrator.migrateToLatest();

for (const result of results ?? []) {
	if (result.status === "Success") {
		console.log(`Migration "${result.migrationName}" executed successfully`);
	} else if (result.status === "Error") {
		console.error(`Migration "${result.migrationName}" failed`);
	}
}

if (error) {
	console.error("Migration failed:", error);
	process.exit(1);
}

if (!results?.length) {
	console.log("No pending migrations");
}

await db.destroy();
