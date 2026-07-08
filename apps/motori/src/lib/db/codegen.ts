// src/lib/db/codegen.ts
// Wrapper so kysely-codegen picks up DATABASE_URL from .env
// Run via: pnpm db:codegen
import { execSync } from "node:child_process";
import { log, withLogContext } from "~/lib/log";

await withLogContext({ script: "codegen" }, async () => {
	const url = process.env.DATABASE_URL;
	if (!url) {
		log.error("DATABASE_URL is not set");
		process.exit(1);
	}

	execSync(`kysely-codegen --url="${url}" --out-file=src/lib/db/schema.generated.ts`, {
		stdio: "inherit",
	});
});
