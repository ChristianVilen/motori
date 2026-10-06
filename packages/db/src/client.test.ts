import pg from "pg";
import { expect, it } from "vitest";
import { createDb } from "./client";

it("parses numeric values into JS numbers", async () => {
	const db = await createDb();
	expect(pg.types.getTypeParser(pg.types.builtins.NUMERIC)("73.5")).toBe(73.5);
	await db.destroy();
});
