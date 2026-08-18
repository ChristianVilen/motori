import { beforeEach, describe, expect, it, vi } from "vitest";

// Queue-based DB mock (bookings.server.test.ts pattern): chained Kysely calls
// return a self-proxy, terminal methods consume from queues. `where` and
// `values` calls are recorded so filters and inserts can be asserted.

const executeQueue: unknown[] = [];
const executeTakeFirstQueue: unknown[] = [];
const whereCalls: unknown[][] = [];
const valuesCalls: unknown[] = [];

function chainable(): unknown {
	return new Proxy(
		{},
		{
			get(_, prop) {
				if (prop === "execute") {
					return () => executeQueue.shift();
				}
				if (prop === "executeTakeFirst") {
					return () => executeTakeFirstQueue.shift();
				}
				if (prop === "where") {
					return (...args: unknown[]) => {
						whereCalls.push(args);
						return chainable();
					};
				}
				if (prop === "values") {
					return (v: unknown) => {
						valuesCalls.push(v);
						return chainable();
					};
				}
				return () => chainable();
			},
		},
	);
}

vi.mock("~/lib/db/index", () => ({
	db: {
		selectFrom: () => chainable(),
		insertInto: () => chainable(),
		deleteFrom: () => chainable(),
	},
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

import { AppError } from "~/lib/errors";
import { getFavoriteListings, toggleFavorite } from "./favorites";

beforeEach(() => {
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
	whereCalls.length = 0;
	valuesCalls.length = 0;
});

describe("toggleFavorite", () => {
	it("removes an existing favorite and reports favorited: false", async () => {
		executeTakeFirstQueue.push({ numDeletedRows: 1n });

		const result = await toggleFavorite("u1", "l1");

		expect(result).toEqual({ favorited: false });
		expect(valuesCalls).toHaveLength(0);
	});

	it("adds a favorite for an existing listing and reports favorited: true", async () => {
		executeTakeFirstQueue.push({ numDeletedRows: 0n }); // delete found nothing
		executeTakeFirstQueue.push({ id: "l1" }); // listing lookup
		executeQueue.push([]); // insert

		const result = await toggleFavorite("u1", "l1");

		expect(result).toEqual({ favorited: true });
		expect(valuesCalls).toHaveLength(1);
		expect(valuesCalls[0]).toMatchObject({ user_id: "u1", listing_id: "l1" });
	});

	it("rejects favoriting a listing that does not exist or is removed", async () => {
		executeTakeFirstQueue.push({ numDeletedRows: 0n });
		executeTakeFirstQueue.push(undefined); // no listing row

		await expect(toggleFavorite("u1", "gone")).rejects.toThrow(AppError);
		expect(valuesCalls).toHaveLength(0);
	});
});

describe("getFavoriteListings", () => {
	it("excludes removed listings and scopes to the user", async () => {
		executeQueue.push([]); // listings query (no rows -> no image query)

		await getFavoriteListings("u1");

		expect(whereCalls).toContainEqual(["favorite.user_id", "=", "u1"]);
		expect(whereCalls).toContainEqual(["listing.status", "!=", "removed"]);
	});
});
