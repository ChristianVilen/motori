import { DatabaseSync } from "node:sqlite";
import { Kysely, SqliteDialect } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "./db/schema";
import { searchListingPage } from "./listings-search.server";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
	CREATE TABLE listing (id TEXT, category TEXT, status TEXT, created_at TEXT, make_id TEXT, model_id TEXT);
	CREATE TABLE listing_sale (listing_id TEXT, price INTEGER, km_driven INTEGER, condition TEXT);
	CREATE TABLE listing_rental (listing_id TEXT, price_per_day INTEGER);
	CREATE TABLE listing_gear (listing_id TEXT, price INTEGER, condition TEXT, size TEXT, gear_type TEXT);
	CREATE TABLE listing_part (listing_id TEXT, price INTEGER, condition TEXT, part_category TEXT);
	CREATE TABLE motorcycle_make (id TEXT, slug TEXT);
	CREATE TABLE motorcycle_model (id TEXT, name TEXT);
	CREATE TABLE listing_image (listing_id TEXT, "order" INTEGER);
`);
for (const [i, category] of ["sale", "rental", "gear", "part", "sale"].entries()) {
	const id = `00000000-0000-4000-8000-00000000000${i}`;
	sqlite
		.prepare("insert into listing values (?,?,?,?,null,null)")
		.run(id, category, i === 4 ? "paused" : "active", "2026-01-01 10:00:00.000123");
	switch (category) {
		case "sale":
			sqlite.prepare("insert into listing_sale values (?,90000,5000,'good')").run(id);
			break;
		case "rental":
			sqlite.prepare("insert into listing_rental values (?,9500)").run(id);
			break;
		case "gear":
			sqlite.prepare("insert into listing_gear values (?,9500,'good','M','jacket')").run(id);
			break;
		case "part":
			sqlite.prepare("insert into listing_part values (?,4000,'good','brakes')").run(id);
			break;
	}
}
const db = new Kysely<Database>({
	dialect: new SqliteDialect({
		database: {
			close: () => sqlite.close(),
			prepare(query) {
				const statement = sqlite.prepare(query);
				return {
					reader: statement.columns().length > 0,
					all: (params) =>
						statement.all(...params.map((v) => (typeof v === "number" ? v : String(v)))),
					iterate: (params) =>
						statement.iterate(...params.map((v) => (typeof v === "number" ? v : String(v)))),
					run: (params) =>
						statement.run(...params.map((v) => (typeof v === "number" ? v : String(v)))),
				};
			},
		},
	}),
});
afterAll(() => db.destroy());

describe("all-category search", () => {
	it("includes active listings with their category facts and ignores a category-specific filter", async () => {
		const result = await searchListingPage(db, { category: "all", make: "Honda" }, 12);
		expect(result.totalCount).toBe(4);
		expect(result.listings.map((l) => [l.category, l.size, l.part_category])).toEqual([
			["part", null, "brakes"],
			["gear", "M", null],
			["rental", null, null],
			["sale", null, null],
		]);
	});
	it("sorts sale prices and daily rental rates together", async () => {
		const result = await searchListingPage(db, { category: "all", sort: "price_asc" }, 12);
		expect(result.listings.map((l) => [l.category, l.price])).toEqual([
			["part", 4000],
			["rental", 9500],
			["gear", 9500],
			["sale", 90000],
		]);
	});
	it.each(["price_asc", "newest"] as const)(
		"restores the full window past tied values with %s",
		async (sort) => {
			const first = await searchListingPage(db, { category: "all", sort }, 2);
			expect(first.nextCursor).toBeTruthy();
			const next = await searchListingPage(
				db,
				{ category: "all", sort, cursor: first.nextCursor ?? undefined },
				2,
			);
			expect(next.listings.map((l) => l.category)).toEqual(
				sort === "price_asc"
					? ["part", "rental", "gear", "sale"]
					: ["part", "gear", "rental", "sale"],
			);
			expect(next.totalCount).toBe(4);
			expect(next.nextCursor).toBeNull();
		},
	);
	it("keeps a legacy keyset link as the start of an expanded window", async () => {
		const filters = { category: "all", sort: "price_asc" } as const;
		const first = await searchListingPage(
			db,
			{ ...filters, cursor: "4000__00000000-0000-4000-8000-000000000003" },
			2,
		);
		expect(first.listings.map((row) => row.category)).toEqual(["rental", "gear"]);
		const more = await searchListingPage(
			db,
			{ ...filters, cursor: first.nextCursor ?? undefined },
			2,
		);
		expect(more.listings.map((row) => row.category)).toEqual(["rental", "gear", "sale"]);
		expect(more.nextCursor).toBeNull();
	});
	it("reorders the whole expanded feed when a listing price crosses the previous page boundary", async () => {
		const filters = { category: "all", sort: "price_asc" } as const;
		const first = await searchListingPage(db, filters, 2);
		const window = { ...filters, cursor: first.nextCursor ?? undefined };
		const before = await searchListingPage(db, window, 2);
		expect(before.listings.map((row) => row.category)).toEqual(["part", "rental", "gear", "sale"]);
		try {
			sqlite.exec("update listing_part set price = 95000");
			const restored = await searchListingPage(db, window, 2);
			expect(restored.listings.map((row) => row.category)).toEqual([
				"rental",
				"gear",
				"sale",
				"part",
			]);
			expect(restored.totalCount).toBe(4);
		} finally {
			sqlite.exec("update listing_part set price = 4000");
		}
	});
});
