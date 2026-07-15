import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: Number(process.env.PORT) || 3001,
	},
	build: {
		// OpenCV.js is a single ~15 MB lazy chunk (scanner route only) — silence
		// the default 500 kB warning rather than pretend we can split WASM.
		chunkSizeWarningLimit: 16_000,
		rollupOptions: {
			external: ["pg", "pg-pool", "pg-connection-string", "pgpass", "split2"],
		},
	},
	define: {
		// Inlined at build time so client-side code has the correct absolute origins.
		"process.env.APP_ORIGIN": JSON.stringify(process.env.APP_ORIGIN ?? "http://localhost:3001"),
		"process.env.BETTER_AUTH_URL": JSON.stringify(
			process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
		),
	},
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	plugins: [tanstackStart(), nitro(), react(), tailwindcss()],
});
