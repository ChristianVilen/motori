// src/lib/db/codegen.ts
// Wrapper so kysely-codegen picks up DATABASE_URL from .env
// Run via: pnpm db:codegen
// biome-ignore-all lint/suspicious/noConsole: CLI script
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL is not set");
	process.exit(1);
}

execSync(`kysely-codegen --url="${url}" --out-file=src/lib/db/schema.generated.ts`, {
	stdio: "inherit",
});
