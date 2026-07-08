import { execSync } from "node:child_process";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

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
