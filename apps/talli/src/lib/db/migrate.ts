import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMigrator } from "@motori/db";
import { log, withLogContext } from "~/lib/log";
import { db } from "./index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await withLogContext({ script: "migrate" }, async () => {
	const migrator = createMigrator({
		db,
		migrationFolder: path.join(__dirname, "migrations"),
		migrationTableSchema: "talli",
	});

	const { error, results } = await migrator.migrateToLatest();

	for (const result of results ?? []) {
		if (result.status === "Success") {
			log.info("migration executed", { migrationName: result.migrationName });
		} else if (result.status === "Error") {
			log.error("migration failed", { migrationName: result.migrationName });
		}
	}

	if (error) {
		log.error("migration run failed", { err: error });
		await db.destroy();
		process.exit(1);
	}

	if (!results?.length) {
		log.info("no pending migrations");
	}

	await db.destroy();
});
