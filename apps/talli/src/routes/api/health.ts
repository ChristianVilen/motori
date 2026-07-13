import { createFileRoute } from "@tanstack/react-router";
import { sql } from "kysely";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: async () => {
				try {
					const { db } = await import("~/lib/db/index");
					await db.selectFrom("talli.vehicle").select(sql`1`.as("ok")).limit(1).execute();
					return new Response(JSON.stringify({ status: "ok" }), {
						headers: { "Content-Type": "application/json" },
					});
				} catch {
					return new Response(JSON.stringify({ status: "error", detail: "db unreachable" }), {
						status: 503,
						headers: { "Content-Type": "application/json" },
					});
				}
			},
		},
	},
});
