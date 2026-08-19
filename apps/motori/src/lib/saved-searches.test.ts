import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	executeQueue,
	orderByCalls,
	resetDbMock,
	valuesCalls,
	whereCalls,
} from "~/test/kysely-mock";

vi.mock("~/lib/db/index", async () => (await import("~/test/kysely-mock")).dbModuleMock());
vi.mock("kysely", async () => (await import("~/test/kysely-mock")).kyselyModuleMock());

import { AppError } from "~/lib/errors";
import { deleteSavedSearch, getSavedSearches, saveSearch } from "./saved-searches";

beforeEach(resetDbMock);

describe("saveSearch", () => {
	it("inserts with correct values", async () => {
		executeQueue.push([]); // existing rows for user (none)
		executeQueue.push([]); // insert

		const id = await saveSearch("u1", "sale", { q: "cb500" });

		expect(typeof id).toBe("string");
		expect(valuesCalls).toHaveLength(1);
		expect(valuesCalls[0]).toMatchObject({
			user_id: "u1",
			category: "sale",
			params: { q: "cb500" },
		});
	});

	it("returns the existing id for a duplicate save without inserting", async () => {
		executeQueue.push([{ id: "existing-id", category: "sale", params: { q: "cb500" } }]);

		const id = await saveSearch("u1", "sale", { q: "cb500" });

		expect(id).toBe("existing-id");
		expect(valuesCalls).toHaveLength(0);
	});

	it("treats params as a duplicate regardless of key order (pg jsonb doesn't preserve it)", async () => {
		// Simulates a row read back from Postgres: jsonb normalizes key order, so the
		// stored object's keys can come back in a different order than fresh Zod output.
		const stored = { make: "Honda", region: "uusimaa", q: "cb500" };
		executeQueue.push([{ id: "existing-id", category: "sale", params: stored }]);

		const id = await saveSearch("u1", "sale", { q: "cb500", region: "uusimaa", make: "Honda" });

		expect(id).toBe("existing-id");
		expect(valuesCalls).toHaveLength(0);
	});

	it("throws AppError with code saved_search.limit_reached at the cap of 20", async () => {
		const existing = Array.from({ length: 20 }, (_, i) => ({
			id: `id-${i}`,
			category: "sale",
			params: { q: `q${i}` },
		}));
		executeQueue.push(existing);

		let error: unknown;
		try {
			await saveSearch("u1", "sale", { q: "new-search" });
		} catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(AppError);
		expect((error as AppError).code).toBe("saved_search.limit_reached");
		expect(valuesCalls).toHaveLength(0);
	});
});

describe("deleteSavedSearch", () => {
	it("scopes the delete by user_id AND id", async () => {
		executeQueue.push([]); // delete

		await deleteSavedSearch("u1", "s1");

		expect(whereCalls).toContainEqual(["user_id", "=", "u1"]);
		expect(whereCalls).toContainEqual(["id", "=", "s1"]);
	});
});

describe("getSavedSearches", () => {
	it("orders results newest first", async () => {
		executeQueue.push([{ id: "s1", category: "sale", params: {}, created_at: new Date() }]);

		await getSavedSearches("u1");

		expect(whereCalls).toContainEqual(["user_id", "=", "u1"]);
		expect(orderByCalls).toContainEqual(["created_at", "desc"]);
	});
});
