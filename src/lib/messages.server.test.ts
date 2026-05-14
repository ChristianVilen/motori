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

vi.mock("~/lib/messages-bus", () => ({
	publish: vi.fn(),
}));

vi.mock("~/lib/email-templates/new-message", () => ({
	sendNewMessageEmail: vi.fn(),
}));

import { AppError } from "./errors";
import {
	blockUserServer,
	getConversationServer,
	sendMessageServer,
	startConversationServer,
} from "./messages.server";

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

describe("sendMessageServer", () => {
	it("throws conversation_not_found when no conversation exists", async () => {
		executeTakeFirstQueue.push(undefined);

		await expect(
			sendMessageServer({ conversationId: "missing", userId: "U1", body: "hi" }),
		).rejects.toMatchObject({ code: "messages.conversation_not_found" });
	});

	it("throws forbidden when the user is not a participant", async () => {
		executeTakeFirstQueue.push({
			id: "C1",
			buyer_id: "B",
			seller_id: "S",
			buyer_last_read_at: null,
			seller_last_read_at: null,
			listing_id: "L1",
			listing_title: "Bike",
			listing_status: "active",
			buyer_email: "b@example.com",
			buyer_email_verified: true,
			seller_email: "s@example.com",
			seller_email_verified: true,
		});

		await expect(
			sendMessageServer({ conversationId: "C1", userId: "STRANGER", body: "hi" }),
		).rejects.toMatchObject({ code: "messages.forbidden" });
	});

	it("throws listing_readonly when the listing is removed", async () => {
		executeTakeFirstQueue.push({
			id: "C1",
			buyer_id: "B",
			seller_id: "S",
			buyer_last_read_at: null,
			seller_last_read_at: null,
			listing_id: "L1",
			listing_title: "Bike",
			listing_status: "removed",
			buyer_email: "b@example.com",
			buyer_email_verified: true,
			seller_email: "s@example.com",
			seller_email_verified: true,
		});

		await expect(
			sendMessageServer({ conversationId: "C1", userId: "B", body: "hi" }),
		).rejects.toMatchObject({ code: "messages.listing_readonly" });
	});
});

describe("block/unblock guards", () => {
	it("blockUserServer rejects self-block", async () => {
		await expect(
			blockUserServer({ userId: "U1", targetUserId: "U1" }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("startConversationServer rate-limits after 10 new conversations / hour", async () => {
		const userId = `RL-${Date.now()}-${Math.random()}`;
		for (let i = 0; i < 10; i++) {
			await expect(
				startConversationServer({ listingId: "L1", userId }),
			).rejects.toBeInstanceOf(AppError);
		}
		await expect(
			startConversationServer({ listingId: "L1", userId }),
		).rejects.toMatchObject({ code: "messages.rate_limited" });
	});
});

describe("getConversationServer", () => {
	it("rejects non-participant", async () => {
		executeTakeFirstQueue.push({
			id: "C1",
			buyer_id: "B",
			seller_id: "S",
			listing_id: "L",
			listing_title: "x",
			listing_status: "active",
			listing_owner_id: "S",
			buyer_name: "B name",
			seller_name: "S name",
		});
		await expect(
			getConversationServer({ conversationId: "C1", userId: "STRANGER" }),
		).rejects.toBeInstanceOf(AppError);
	});
});
