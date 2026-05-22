import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Force-load .env into process.env, overriding any shell-inherited values.
// Node's loadEnvFile / --env-file skip keys already present in the environment,
// which breaks per-worktree dev: a stale BETTER_AUTH_URL in the parent shell
// would cause the define block below to inline the wrong canonical URL.
try {
	const envText = readFileSync(".env", "utf8");
	for (const rawLine of envText.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) {
			continue;
		}
		const eq = line.indexOf("=");
		if (eq <= 0) {
			continue;
		}
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
} catch {}

const appVersion = (() => {
	if (process.env.SOURCE_VERSION) {
		return process.env.SOURCE_VERSION.slice(0, 7);
	}
	try {
		return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
	} catch {
		return "dev";
	}
})();

export default defineConfig({
	server: {
		port: Number(process.env.PORT) || 3000,
	},
	build: {
		rollupOptions: {
			external: ["pg", "pg-pool", "pg-connection-string", "pgpass", "split2"],
		},
	},
	define: {
		// Inline BETTER_AUTH_URL at build time so client-side head() calls produce
		// the correct absolute SITE_URL instead of falling back to localhost.
		"process.env.BETTER_AUTH_URL": JSON.stringify(
			process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
		),
		__APP_VERSION__: JSON.stringify(appVersion),
	},
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	plugins: [tanstackStart(), nitro(), react(), tailwindcss()],
});
