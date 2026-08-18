import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	executeQueue,
	executeTakeFirstQueue,
	resetDbMock,
	valuesCalls,
	whereCalls,
} from "~/test/kysely-mock";

vi.mock("~/lib/db/index", async () => (await import("~/test/kysely-mock")).dbModuleMock());
vi.mock("kysely", async () => (await import("~/test/kysely-mock")).kyselyModuleMock());

import { AppError } from "~/lib/errors";
import { getFavoriteListings, toggleFavorite } from "./favorites";

beforeEach(resetDbMock);

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
