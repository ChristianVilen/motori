import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { log, withLogContext } from "~/lib/log";

await withLogContext({ script: "purge-sessions" }, async () => {
	const result = await db
		.deleteFrom("session")
		.where("expiresAt", "<", sql<Date>`now()`)
		.executeTakeFirst();
	log.info("expired sessions purged", { deleted: Number(result.numDeletedRows) });
	await db.destroy();
});
