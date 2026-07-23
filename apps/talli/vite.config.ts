import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type ViteDevServer } from "vite";

// Dev-only: Vite serves the optimized opencv dep (~16 MB) with its ~50 MB
// sourcemap inlined — a 65 MB response. Loopback doesn't notice; a phone on
// Wi-Fi (LAN dev) stalls for minutes on the scanner route. Serve the
// pre-bundled file as-is, without the map.
const OPENCV_DEP = "/node_modules/.vite/deps/@techstark_opencv-js.js";
const opencvDepWithoutSourcemap = {
	name: "opencv-dep-without-sourcemap",
	apply: "serve" as const,
	configureServer(server: ViteDevServer) {
		server.middlewares.use((req, res, next) => {
			if ((req.url ?? "").split("?")[0] !== OPENCV_DEP) {
				return next();
			}
			fs.readFile(
				path.join(server.config.cacheDir, "deps/@techstark_opencv-js.js"),
				(err, content) => {
					if (err) {
						return next(); // not optimized yet — let Vite handle discovery
					}
					res.setHeader("Content-Type", "text/javascript");
					res.setHeader("Cache-Control", "max-age=31536000, immutable");
					res.end(content);
				},
			);
		});
	},
};

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
	plugins: [tanstackStart(), nitro(), react(), tailwindcss(), opencvDepWithoutSourcemap],
});
