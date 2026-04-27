import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
	server: {
		port: 3000,
	},
	resolve: {
		alias: {
			"~": path.resolve(import.meta.dirname, "./src"),
		},
	},
	plugins: [devtools(), tanstackStart(), nitro(), react(), tailwindcss()],
});
