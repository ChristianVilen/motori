import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		// No unit tests yet — keeps root `pnpm -r test` green until the first test lands.
		passWithNoTests: true,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		exclude: ["e2e/**", "node_modules/**", ".output/**"],
	},
});
