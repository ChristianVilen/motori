import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Queue-based DB mock ---
// See bookings.server.test.ts for pattern. Tests push expected results onto
// queues IN THE ORDER the production code executes its queries.

const executeQueue: unknown[] = [];
const executeTakeFirstQueue: unknown[] = [];
const executeTakeFirstOrThrowQueue: unknown[] = [];

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
				if (prop === "executeTakeFirstOrThrow") {
					return () => executeTakeFirstOrThrowQueue.shift();
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
		updateTable: () => chainable(),
		deleteFrom: () => chainable(),
	},
}));

vi.mock("~/lib/log", () => ({
	log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

import { AppError } from "./errors";
import { startConversationServer } from "./messages.server";

beforeEach(() => {
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
	executeTakeFirstOrThrowQueue.length = 0;
});

describe("startConversationServer", () => {
	it("throws own_listing when the user owns the listing", async () => {
		executeTakeFirstQueue.push({ id: "L1", owner_id: "U1", status: "active" });

		await expect(
			startConversationServer({ listingId: "L1", userId: "U1" }),
		).rejects.toMatchObject({ code: "messages.own_listing" });
	});

	it("throws listing_not_found when the listing does not exist", async () => {
		executeTakeFirstQueue.push(undefined);

		await expect(
			startConversationServer({ listingId: "missing", userId: "U1" }),
		).rejects.toMatchObject({ code: "messages.listing_not_found" });
	});

	it("throws listing_unavailable when the listing is removed", async () => {
		executeTakeFirstQueue.push({ id: "L1", owner_id: "OTHER", status: "removed" });

		await expect(
			startConversationServer({ listingId: "L1", userId: "U1" }),
		).rejects.toMatchObject({ code: "messages.listing_unavailable" });
	});

	it("throws blocked when a block exists in either direction", async () => {
		executeTakeFirstQueue.push({ id: "L1", owner_id: "OTHER", status: "active" });
		executeTakeFirstQueue.push({ blocker_id: "OTHER" });

		await expect(
			startConversationServer({ listingId: "L1", userId: "U1" }),
		).rejects.toMatchObject({ code: "messages.blocked" });
	});

	it("returns the existing conversation id when one already exists (idempotent)", async () => {
		executeTakeFirstQueue.push({ id: "L1", owner_id: "OTHER", status: "active" });
		executeTakeFirstQueue.push(undefined); // block lookup
		executeTakeFirstQueue.push({ id: "C1" }); // existing conversation

		const result = await startConversationServer({ listingId: "L1", userId: "U1" });
		expect(result).toEqual({ conversationId: "C1" });
	});

	it("AppError instances thrown by guards carry the expected code", async () => {
		executeTakeFirstQueue.push({ id: "L1", owner_id: "U1", status: "active" });
		try {
			await startConversationServer({ listingId: "L1", userId: "U1" });
			throw new Error("expected throw");
		} catch (err) {
			expect(err).toBeInstanceOf(AppError);
		}
	});
});
