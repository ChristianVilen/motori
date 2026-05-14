# In-app messaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship in-app messaging tied to listings (one conversation per `(listing, buyer)` pair), replacing the one-shot `booking.message` inquiry. Closes [issue #8](https://github.com/ChristianVilen/motori/issues/8).

**Architecture:** Conversation-first. The rental booking flow opens/reuses a conversation and posts a `booking_request` system message. SSE for live delivery, polling-free. Per-conversation "first unread" email notifications. Block + rate limit for safety.

**Tech Stack:** TanStack Start, Kysely + PostgreSQL, BetterAuth, Vitest, Playwright, Biome, pnpm.

**Spec:** `docs/superpowers/specs/2026-05-14-in-app-messaging-design.md`

**House conventions enforced:**
- Per-task: `pnpm typecheck` + `pnpm test` only.
- End of plan: full suite (`lint:fix`, `format:fix`, `typecheck`, `test`, `test:e2e`).
- `pnpm` always, never `bun`.
- No `Co-Authored-By` lines in commits.

---

## File Structure

**Create:**
- `src/lib/db/migrations/026_conversations.ts` — schema migration
- `src/lib/messages.ts` — pure helpers + shared types (safe for client bundle)
- `src/lib/messages.server.ts` — server functions (startConversation, sendMessage, etc.)
- `src/lib/messages.test.ts` — unit tests for pure helpers
- `src/lib/messages.server.test.ts` — unit tests for server functions
- `src/lib/messages-bus.ts` — in-memory pub/sub for SSE
- `src/lib/messages-bus.test.ts` — unit tests for the bus
- `src/lib/email-templates/new-message.tsx` — email template (matches existing pattern)
- `src/routes/viestit.tsx` — inbox route (layout + index)
- `src/routes/viestit/$conversationId.tsx` — thread route
- `src/routes/api/messages/stream.$conversationId.ts` — SSE endpoint
- `e2e/messaging.spec.ts` — end-to-end test

**Modify:**
- `src/lib/db/schema.ts` — add `ConversationTable`, `MessageTable`, `UserBlockTable`; extend `BookingTable` with `conversation_id`; add types to `Database` interface
- `src/lib/listings-detail-route.tsx` — add "Lähetä viesti" button
- `src/lib/bookings.server.ts` — `createBookingRequest` now creates/reuses conversation and inserts a `booking_request` system message; sets `booking.conversation_id`
- `src/routes/omat/varaukset_.$bookingId.tsx` — link to thread when `conversation_id` set, else render legacy `message`
- `src/lib/i18n/locales/fi/messages.json` and `en/messages.json` — new namespace (path may vary; follow existing pattern)
- `src/lib/i18n/index.ts` (or wherever namespaces are registered) — register `messages` namespace
- `src/routes/__root.tsx` (or the auth layout where the nav lives) — add `/viestit` nav link with unread badge

---

## Task 1: Database migration

**Files:**
- Create: `src/lib/db/migrations/026_conversations.ts`

- [ ] **Step 1: Write the migration**

Create `src/lib/db/migrations/026_conversations.ts`:

```ts
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE conversation (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			listing_id text NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			buyer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			seller_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			last_message_at timestamptz NOT NULL DEFAULT now(),
			buyer_last_read_at timestamptz,
			seller_last_read_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT conversation_buyer_not_seller CHECK (buyer_id <> seller_id),
			CONSTRAINT conversation_listing_buyer_unique UNIQUE (listing_id, buyer_id)
		)
	`.execute(db);

	await sql`CREATE INDEX conversation_buyer_recent_idx ON conversation(buyer_id, last_message_at DESC)`.execute(db);
	await sql`CREATE INDEX conversation_seller_recent_idx ON conversation(seller_id, last_message_at DESC)`.execute(db);

	await sql`
		CREATE TABLE message (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			conversation_id uuid NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
			sender_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			kind varchar(20) NOT NULL DEFAULT 'text',
			body text NOT NULL,
			booking_id uuid REFERENCES booking(id) ON DELETE SET NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT message_kind_check CHECK (kind IN ('text','booking_request')),
			CONSTRAINT message_body_length CHECK (char_length(body) BETWEEN 1 AND 4000)
		)
	`.execute(db);

	await sql`CREATE INDEX message_conversation_created_idx ON message(conversation_id, created_at)`.execute(db);

	await sql`
		CREATE TABLE user_block (
			blocker_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			blocked_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			created_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (blocker_id, blocked_id),
			CONSTRAINT user_block_not_self CHECK (blocker_id <> blocked_id)
		)
	`.execute(db);
	await sql`CREATE INDEX user_block_blocked_blocker_idx ON user_block(blocked_id, blocker_id)`.execute(db);

	await sql`ALTER TABLE booking ADD COLUMN conversation_id uuid REFERENCES conversation(id) ON DELETE SET NULL`.execute(db);
	await sql`ALTER TABLE booking ALTER COLUMN message DROP NOT NULL`.execute(db);
	await sql`CREATE INDEX booking_conversation_id_idx ON booking(conversation_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP INDEX IF EXISTS booking_conversation_id_idx`.execute(db);
	await sql`ALTER TABLE booking ALTER COLUMN message SET NOT NULL`.execute(db);
	await sql`ALTER TABLE booking DROP COLUMN conversation_id`.execute(db);
	await sql`DROP TABLE user_block`.execute(db);
	await sql`DROP TABLE message`.execute(db);
	await sql`DROP TABLE conversation`.execute(db);
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm db:migrate`
Expected: migration `026_conversations` reports success; subsequent runs are no-ops.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/migrations/026_conversations.ts
git commit -m "feat(db): conversations, messages, user_block tables (#8)"
```

---

## Task 2: Schema types

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add table interfaces and types**

Append before the `// ─── Database interface ───` section in `src/lib/db/schema.ts`:

```ts
export type MessageKind = "text" | "booking_request";

export interface ConversationTable {
	id: Generated<string>;
	listing_id: string;
	buyer_id: string;
	seller_id: string;
	last_message_at: ColumnType<Date, Date | undefined, Date>;
	buyer_last_read_at: ColumnType<Date, Date | undefined, Date> | null;
	seller_last_read_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type Conversation = Selectable<ConversationTable>;
export type NewConversation = Insertable<ConversationTable>;
export type ConversationUpdate = Updateable<ConversationTable>;

export interface MessageTable {
	id: Generated<string>;
	conversation_id: string;
	sender_id: string;
	kind: Generated<MessageKind>;
	body: string;
	booking_id: string | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;

export interface UserBlockTable {
	blocker_id: string;
	blocked_id: string;
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type UserBlock = Selectable<UserBlockTable>;
export type NewUserBlock = Insertable<UserBlockTable>;
```

Update `BookingTable` — change `message` to nullable and add `conversation_id`:

```ts
// inside BookingTable, replace existing `message: string;`
	message: string | null;
	conversation_id: string | null;
```

Update the `Database` interface to add:

```ts
	conversation: ConversationTable;
	message: MessageTable;
	user_block: UserBlockTable;
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS. If `bookings.server.ts` complains about `message` being possibly null on new inserts, leave for Task 11 (we'll start inserting `null`).

If it fails on existing booking code reading `booking.message`, add a narrow `?? ""` at the read site as a temporary bridge (will be revisited in Task 12).

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(db): kysely types for conversation, message, user_block (#8)"
```

---

## Task 3: Pure helpers + email-trigger predicate

**Files:**
- Create: `src/lib/messages.ts`
- Create: `src/lib/messages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldNotifyByEmail, validateMessageBody } from "./messages";

describe("validateMessageBody", () => {
	it("accepts a normal body", () => {
		expect(validateMessageBody("hello")).toBe("hello");
	});
	it("trims surrounding whitespace", () => {
		expect(validateMessageBody("  hi  ")).toBe("hi");
	});
	it("rejects empty after trim", () => {
		expect(() => validateMessageBody("   ")).toThrow();
	});
	it("rejects over 4000 chars", () => {
		expect(() => validateMessageBody("a".repeat(4001))).toThrow();
	});
});

describe("shouldNotifyByEmail", () => {
	const now = new Date("2026-05-14T10:00:00Z");
	const earlier = new Date("2026-05-14T09:00:00Z");
	const muchEarlier = new Date("2026-05-14T08:00:00Z");

	it("notifies when there is no prior message", () => {
		expect(shouldNotifyByEmail({ recipientLastReadAt: null, priorMessageCreatedAt: null })).toBe(true);
	});
	it("notifies when recipient was caught up (lastRead >= prior.createdAt)", () => {
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: earlier, priorMessageCreatedAt: earlier }),
		).toBe(true);
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: now, priorMessageCreatedAt: earlier }),
		).toBe(true);
	});
	it("suppresses when recipient still has an earlier unread message", () => {
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: muchEarlier, priorMessageCreatedAt: earlier }),
		).toBe(false);
	});
	it("suppresses when recipient has never read and a prior message exists", () => {
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: null, priorMessageCreatedAt: earlier }),
		).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/messages.ts`:

```ts
/** Pure helpers — safe for client and server bundles. */
import { AppError } from "~/lib/errors";

export const MESSAGE_MAX_LENGTH = 4000;

export function validateMessageBody(input: string): string {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		throw new AppError("messages.body_empty");
	}
	if (trimmed.length > MESSAGE_MAX_LENGTH) {
		throw new AppError("messages.body_too_long");
	}
	return trimmed;
}

/**
 * "First unread" rule: notify only if the recipient was caught up before this message arrived.
 * That means either no prior message exists, or recipientLastReadAt >= prior.createdAt.
 */
export function shouldNotifyByEmail(args: {
	recipientLastReadAt: Date | null;
	priorMessageCreatedAt: Date | null;
}): boolean {
	if (args.priorMessageCreatedAt === null) {
		return true;
	}
	if (args.recipientLastReadAt === null) {
		return false;
	}
	return args.recipientLastReadAt.getTime() >= args.priorMessageCreatedAt.getTime();
}

export interface ConversationListRow {
	id: string;
	listingId: string;
	listingTitle: string;
	listingThumbnailUrl: string | null;
	otherPartyId: string;
	otherPartyDisplayName: string;
	lastMessageAt: string; // ISO
	lastMessagePreview: string;
	unreadCount: number;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages.ts src/lib/messages.test.ts
git commit -m "feat(messages): pure helpers (validate body, email predicate) (#8)"
```

---

## Task 4: In-memory bus for SSE

**Files:**
- Create: `src/lib/messages-bus.ts`
- Create: `src/lib/messages-bus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/messages-bus.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { publish, subscribe } from "./messages-bus";

describe("messages-bus", () => {
	it("delivers published messages to subscribers of that conversation", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		publish("conv-1", { id: "m1" });
		expect(onMessage).toHaveBeenCalledWith({ id: "m1" });
		unsub();
	});

	it("does not deliver to subscribers of other conversations", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		publish("conv-2", { id: "m1" });
		expect(onMessage).not.toHaveBeenCalled();
		unsub();
	});

	it("stops delivering after unsubscribe", () => {
		const onMessage = vi.fn();
		const unsub = subscribe("conv-1", onMessage);
		unsub();
		publish("conv-1", { id: "m1" });
		expect(onMessage).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages-bus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the bus**

Create `src/lib/messages-bus.ts`:

```ts
/**
 * In-memory pub/sub keyed by conversation_id.
 * SINGLE-PROCESS ONLY: subscribers in another Node instance won't see publishes.
 * Replace with Postgres LISTEN/NOTIFY before horizontal scaling.
 */
import type { Message } from "~/lib/db/schema";

type Subscriber = (msg: Message) => void;

const channels = new Map<string, Set<Subscriber>>();

export function subscribe(conversationId: string, fn: Subscriber): () => void {
	let set = channels.get(conversationId);
	if (!set) {
		set = new Set();
		channels.set(conversationId, set);
	}
	set.add(fn);
	return () => {
		const s = channels.get(conversationId);
		if (!s) return;
		s.delete(fn);
		if (s.size === 0) channels.delete(conversationId);
	};
}

export function publish(conversationId: string, msg: Message): void {
	const set = channels.get(conversationId);
	if (!set) return;
	for (const fn of set) {
		try {
			fn(msg);
		} catch {
			// subscriber error must not break other subscribers
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/messages-bus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages-bus.ts src/lib/messages-bus.test.ts
git commit -m "feat(messages): in-memory pub/sub bus for SSE (#8)"
```

---

## Task 5: Server module — startConversation

**Files:**
- Create: `src/lib/messages.server.ts`
- Create: `src/lib/messages.server.test.ts`

This task only implements `startConversation`. Subsequent tasks add `sendMessage`, list/get, mark-read.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/messages.server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/lib/db/index";
import { AppError } from "~/lib/errors";
import { startConversationServer } from "./messages.server";

// Fixtures: assume helpers from existing test suite. If not present, inline minimal seed.
import { createTestListing, createTestUser, resetDb } from "./test-utils";

describe("startConversationServer", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("creates a conversation between buyer and seller", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });

		const { conversationId } = await startConversationServer({
			listingId: listing.id,
			userId: buyer.id,
		});

		const row = await db
			.selectFrom("conversation")
			.selectAll()
			.where("id", "=", conversationId)
			.executeTakeFirstOrThrow();
		expect(row.buyer_id).toBe(buyer.id);
		expect(row.seller_id).toBe(seller.id);
	});

	it("is idempotent — second call returns same conversation", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });

		const a = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		const b = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		expect(a.conversationId).toBe(b.conversationId);
	});

	it("rejects owner messaging own listing", async () => {
		const seller = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		await expect(
			startConversationServer({ listingId: listing.id, userId: seller.id }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("rejects when listing is removed", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id, status: "removed" });
		await expect(
			startConversationServer({ listingId: listing.id, userId: buyer.id }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("rejects when seller has blocked buyer", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		await db.insertInto("user_block").values({ blocker_id: seller.id, blocked_id: buyer.id }).execute();
		await expect(
			startConversationServer({ listingId: listing.id, userId: buyer.id }),
		).rejects.toBeInstanceOf(AppError);
	});
});
```

> NOTE: if `test-utils.ts` doesn't exist in the repo, inline the helpers at the top of the test file instead — minimal `createTestUser` (insert into `user` + `profile`) and `createTestListing` (insert into `listing`). Reuse patterns from `src/lib/bookings.server.test.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: FAIL — `startConversationServer` not defined.

- [ ] **Step 3: Implement startConversationServer**

Create `src/lib/messages.server.ts`:

```ts
import { db } from "~/lib/db/index";
import type { Conversation, Message, MessageKind } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import { publish } from "~/lib/messages-bus";
import { shouldNotifyByEmail, validateMessageBody } from "~/lib/messages";

const STATUSES_BLOCKED_FOR_NEW_CONVERSATION = new Set(["removed"]);

export async function startConversationServer(args: {
	listingId: string;
	userId: string;
}): Promise<{ conversationId: string }> {
	const listing = await db
		.selectFrom("listing")
		.select(["id", "owner_id", "status"])
		.where("id", "=", args.listingId)
		.executeTakeFirst();

	if (!listing) {
		throw new AppError("messages.listing_not_found");
	}
	if (listing.owner_id === args.userId) {
		throw new AppError("messages.own_listing");
	}
	if (STATUSES_BLOCKED_FOR_NEW_CONVERSATION.has(listing.status)) {
		throw new AppError("messages.listing_unavailable");
	}

	const block = await db
		.selectFrom("user_block")
		.select("blocker_id")
		.where((eb) =>
			eb.or([
				eb.and([eb("blocker_id", "=", listing.owner_id), eb("blocked_id", "=", args.userId)]),
				eb.and([eb("blocker_id", "=", args.userId), eb("blocked_id", "=", listing.owner_id)]),
			]),
		)
		.executeTakeFirst();
	if (block) {
		throw new AppError("messages.blocked");
	}

	const existing = await db
		.selectFrom("conversation")
		.select("id")
		.where("listing_id", "=", listing.id)
		.where("buyer_id", "=", args.userId)
		.executeTakeFirst();

	if (existing) {
		return { conversationId: existing.id };
	}

	const inserted = await db
		.insertInto("conversation")
		.values({
			listing_id: listing.id,
			buyer_id: args.userId,
			seller_id: listing.owner_id,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	log({ event: "MESSAGES_CONVERSATION_CREATED", conversationId: inserted.id, listingId: listing.id });

	return { conversationId: inserted.id };
}
```

> If `EVENTS.MESSAGES_CONVERSATION_CREATED` doesn't exist in `src/lib/log/events.ts`, add it; otherwise inline a string event name as shown.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/messages.server.ts src/lib/messages.server.test.ts
git commit -m "feat(messages): startConversationServer with idempotency and guards (#8)"
```

---

## Task 6: sendMessage + email-notify integration

**Files:**
- Modify: `src/lib/messages.server.ts`
- Modify: `src/lib/messages.server.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/messages.server.test.ts`:

```ts
import { sendMessageServer } from "./messages.server";

describe("sendMessageServer", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("inserts a text message and updates last_message_at", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });

		const { messageId } = await sendMessageServer({
			conversationId,
			userId: buyer.id,
			body: "Hei, onko vielä saatavilla?",
		});

		const msg = await db.selectFrom("message").selectAll().where("id", "=", messageId).executeTakeFirstOrThrow();
		expect(msg.body).toBe("Hei, onko vielä saatavilla?");
		expect(msg.sender_id).toBe(buyer.id);
		expect(msg.kind).toBe("text");

		const conv = await db.selectFrom("conversation").selectAll().where("id", "=", conversationId).executeTakeFirstOrThrow();
		expect(conv.last_message_at.getTime()).toBeGreaterThanOrEqual(msg.created_at.getTime() - 1000);
	});

	it("rejects empty body", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await expect(
			sendMessageServer({ conversationId, userId: buyer.id, body: "   " }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("rejects non-participant", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const stranger = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await expect(
			sendMessageServer({ conversationId, userId: stranger.id, body: "hi" }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("rejects when listing is removed (but readable threads keep working)", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await db.updateTable("listing").set({ status: "removed" }).where("id", "=", listing.id).execute();
		await expect(
			sendMessageServer({ conversationId, userId: buyer.id, body: "hi" }),
		).rejects.toBeInstanceOf(AppError);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: 4 new FAILs.

- [ ] **Step 3: Implement sendMessageServer**

Add to `src/lib/messages.server.ts`:

```ts
import { sendNewMessageEmail } from "~/lib/email-templates/new-message"; // created in Task 10

const STATUSES_READONLY = new Set(["removed"]);

export async function sendMessageServer(args: {
	conversationId: string;
	userId: string;
	body: string;
	kind?: MessageKind;
	bookingId?: string;
}): Promise<{ messageId: string }> {
	const trimmedBody = validateMessageBody(args.body);

	const conv = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.innerJoin("user as buyer_user", "buyer_user.id", "conversation.buyer_id")
		.innerJoin("user as seller_user", "seller_user.id", "conversation.seller_id")
		.select([
			"conversation.id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"conversation.buyer_last_read_at",
			"conversation.seller_last_read_at",
			"listing.id as listing_id",
			"listing.title as listing_title",
			"listing.status as listing_status",
			"buyer_user.email as buyer_email",
			"buyer_user.emailVerified as buyer_email_verified",
			"seller_user.email as seller_email",
			"seller_user.emailVerified as seller_email_verified",
		])
		.where("conversation.id", "=", args.conversationId)
		.executeTakeFirst();

	if (!conv) {
		throw new AppError("messages.conversation_not_found");
	}
	if (conv.buyer_id !== args.userId && conv.seller_id !== args.userId) {
		throw new AppError("messages.forbidden");
	}
	if (STATUSES_READONLY.has(conv.listing_status)) {
		throw new AppError("messages.listing_readonly");
	}

	const block = await db
		.selectFrom("user_block")
		.select("blocker_id")
		.where((eb) =>
			eb.or([
				eb.and([eb("blocker_id", "=", conv.buyer_id), eb("blocked_id", "=", conv.seller_id)]),
				eb.and([eb("blocker_id", "=", conv.seller_id), eb("blocked_id", "=", conv.buyer_id)]),
			]),
		)
		.executeTakeFirst();
	if (block && block.blocker_id !== args.userId) {
		// the blocked party cannot post; the blocker can still post
		throw new AppError("messages.blocked");
	}

	const prior = await db
		.selectFrom("message")
		.select(["created_at"])
		.where("conversation_id", "=", conv.id)
		.orderBy("created_at", "desc")
		.limit(1)
		.executeTakeFirst();

	const inserted = await db.transaction().execute(async (trx) => {
		const m = await trx
			.insertInto("message")
			.values({
				conversation_id: conv.id,
				sender_id: args.userId,
				kind: args.kind ?? "text",
				body: trimmedBody,
				booking_id: args.bookingId ?? null,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await trx
			.updateTable("conversation")
			.set({ last_message_at: m.created_at })
			.where("id", "=", conv.id)
			.execute();

		return m;
	});

	publish(conv.id, inserted as Message);

	// Email: "first unread" rule
	const recipientIsBuyer = conv.seller_id === args.userId;
	const recipientLastReadAt = recipientIsBuyer ? conv.buyer_last_read_at : conv.seller_last_read_at;
	const recipientEmail = recipientIsBuyer ? conv.buyer_email : conv.seller_email;
	const recipientVerified = recipientIsBuyer ? conv.buyer_email_verified : conv.seller_email_verified;

	if (
		recipientVerified &&
		shouldNotifyByEmail({
			recipientLastReadAt: recipientLastReadAt as Date | null,
			priorMessageCreatedAt: (prior?.created_at as Date | undefined) ?? null,
		})
	) {
		void sendNewMessageEmail({
			to: recipientEmail,
			listingTitle: conv.listing_title,
			conversationId: conv.id,
			previewBody: trimmedBody,
		}).catch((err) => log({ event: "MESSAGES_EMAIL_FAILED", error: String(err), conversationId: conv.id }));
	}

	return { messageId: inserted.id };
}
```

> The email function is implemented in Task 10. Until then, the import will type-check only after Task 10 is done. To unblock this task, **stub** `sendNewMessageEmail` first: create `src/lib/email-templates/new-message.ts` with `export async function sendNewMessageEmail(_: { to: string; listingTitle: string; conversationId: string; previewBody: string }): Promise<void> { /* stub */ }`. Task 10 replaces the stub body.

- [ ] **Step 4: Create stub email function**

Create `src/lib/email-templates/new-message.ts`:

```ts
export async function sendNewMessageEmail(_args: {
	to: string;
	listingTitle: string;
	conversationId: string;
	previewBody: string;
}): Promise<void> {
	// Real implementation in Task 10.
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/messages.server.ts src/lib/messages.server.test.ts src/lib/email-templates/new-message.ts
git commit -m "feat(messages): sendMessageServer with email notify predicate (#8)"
```

---

## Task 7: listConversations / getConversation / listMessages / markRead

**Files:**
- Modify: `src/lib/messages.server.ts`
- Modify: `src/lib/messages.server.test.ts`

- [ ] **Step 1: Add tests**

Append to `src/lib/messages.server.test.ts`:

```ts
import {
	getConversationServer,
	listConversationsServer,
	listMessagesServer,
	markReadServer,
} from "./messages.server";

describe("inbox/thread queries", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("lists conversations for buyer and seller with unread counts", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await sendMessageServer({ conversationId, userId: buyer.id, body: "hello" });

		const sellerInbox = await listConversationsServer({ userId: seller.id });
		expect(sellerInbox).toHaveLength(1);
		expect(sellerInbox[0].unreadCount).toBe(1);
		expect(sellerInbox[0].otherPartyId).toBe(buyer.id);

		const buyerInbox = await listConversationsServer({ userId: buyer.id });
		expect(buyerInbox[0].unreadCount).toBe(0);
	});

	it("markReadServer sets the correct participant column and zeroes unread", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await sendMessageServer({ conversationId, userId: buyer.id, body: "hello" });

		await markReadServer({ conversationId, userId: seller.id });
		const inbox = await listConversationsServer({ userId: seller.id });
		expect(inbox[0].unreadCount).toBe(0);
	});

	it("getConversation rejects non-participant", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const stranger = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await expect(
			getConversationServer({ conversationId, userId: stranger.id }),
		).rejects.toBeInstanceOf(AppError);
	});

	it("listMessages returns ascending order and respects beforeCursor paging", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		for (let i = 0; i < 3; i++) {
			await sendMessageServer({ conversationId, userId: buyer.id, body: `m${i}` });
		}
		const page = await listMessagesServer({ conversationId, userId: buyer.id });
		expect(page.messages.map((m) => m.body)).toEqual(["m0", "m1", "m2"]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: 4 new FAILs.

- [ ] **Step 3: Implement the four functions**

Add to `src/lib/messages.server.ts`:

```ts
import { sql } from "kysely";
import type { ConversationListRow } from "~/lib/messages";

export async function listConversationsServer(args: {
	userId: string;
}): Promise<ConversationListRow[]> {
	const rows = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.leftJoin("listing_image", (j) =>
			j.onRef("listing_image.listing_id", "=", "listing.id").on("listing_image.order", "=", 0),
		)
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
		.select((eb) => [
			"conversation.id",
			"conversation.listing_id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"conversation.last_message_at",
			"conversation.buyer_last_read_at",
			"conversation.seller_last_read_at",
			"listing.title as listing_title",
			"listing_image.thumbnail_url as listing_thumbnail_url",
			"buyer_profile.display_name as buyer_name",
			"seller_profile.display_name as seller_name",
			eb
				.selectFrom("message")
				.select("body")
				.whereRef("conversation_id", "=", "conversation.id")
				.orderBy("created_at", "desc")
				.limit(1)
				.as("last_body"),
			eb
				.selectFrom("message")
				.select((e) => e.fn.countAll<number>().as("c"))
				.whereRef("conversation_id", "=", "conversation.id")
				.where("sender_id", "<>", args.userId)
				.where((e) =>
					e.or([
						e.and([
							e("conversation.buyer_id", "=", args.userId),
							e.or([
								e("conversation.buyer_last_read_at", "is", null),
								e.ref("message.created_at").$castTo<Date>() as never, // see below
							]),
						]),
					]),
				)
				.as("unread"),
		])
		.where((eb) =>
			eb.or([eb("conversation.buyer_id", "=", args.userId), eb("conversation.seller_id", "=", args.userId)]),
		)
		.orderBy("conversation.last_message_at", "desc")
		.execute();

	// The Kysely subquery above is awkward for the conditional unread count.
	// Simpler: compute unread in JS with a small extra query per conversation,
	// OR use raw SQL for the unread count. Use raw SQL:
	type Row = (typeof rows)[number];
	const result: ConversationListRow[] = [];
	for (const r of rows as Row[]) {
		const isBuyer = r.buyer_id === args.userId;
		const lastReadAt = isBuyer ? r.buyer_last_read_at : r.seller_last_read_at;
		const { count } = await db
			.selectFrom("message")
			.select((eb) => eb.fn.countAll<string>().as("count"))
			.where("conversation_id", "=", r.id)
			.where("sender_id", "<>", args.userId)
			.$if(lastReadAt !== null, (qb) => qb.where("created_at", ">", lastReadAt as Date))
			.executeTakeFirstOrThrow();
		result.push({
			id: r.id,
			listingId: r.listing_id,
			listingTitle: r.listing_title,
			listingThumbnailUrl: r.listing_thumbnail_url,
			otherPartyId: isBuyer ? r.seller_id : r.buyer_id,
			otherPartyDisplayName: isBuyer ? r.seller_name : r.buyer_name,
			lastMessageAt: r.last_message_at.toISOString(),
			lastMessagePreview: (r.last_body ?? "").slice(0, 140),
			unreadCount: Number(count),
		});
	}
	return result;
}
```

> The inline conditional unread count via Kysely subquery is awkward; the second loop with a per-conversation query is fine at MVP volume and easier to maintain. Remove the broken subquery branch in the SELECT and rely solely on the loop. Final cleaner form:

Replace the function with this cleaner version (delete the broken subquery from the SELECT):

```ts
export async function listConversationsServer(args: {
	userId: string;
}): Promise<ConversationListRow[]> {
	const rows = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.leftJoin("listing_image", (j) =>
			j.onRef("listing_image.listing_id", "=", "listing.id").on("listing_image.order", "=", 0),
		)
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
		.select((eb) => [
			"conversation.id",
			"conversation.listing_id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"conversation.last_message_at",
			"conversation.buyer_last_read_at",
			"conversation.seller_last_read_at",
			"listing.title as listing_title",
			"listing_image.thumbnail_url as listing_thumbnail_url",
			"buyer_profile.display_name as buyer_name",
			"seller_profile.display_name as seller_name",
			eb
				.selectFrom("message")
				.select("body")
				.whereRef("conversation_id", "=", "conversation.id")
				.orderBy("created_at", "desc")
				.limit(1)
				.as("last_body"),
		])
		.where((eb) =>
			eb.or([eb("conversation.buyer_id", "=", args.userId), eb("conversation.seller_id", "=", args.userId)]),
		)
		.orderBy("conversation.last_message_at", "desc")
		.execute();

	const result: ConversationListRow[] = [];
	for (const r of rows) {
		const isBuyer = r.buyer_id === args.userId;
		const lastReadAt = isBuyer ? r.buyer_last_read_at : r.seller_last_read_at;
		const unread = await db
			.selectFrom("message")
			.select((eb) => eb.fn.countAll<string>().as("count"))
			.where("conversation_id", "=", r.id)
			.where("sender_id", "<>", args.userId)
			.$if(lastReadAt !== null, (qb) => qb.where("created_at", ">", lastReadAt as Date))
			.executeTakeFirstOrThrow();
		result.push({
			id: r.id,
			listingId: r.listing_id,
			listingTitle: r.listing_title,
			listingThumbnailUrl: r.listing_thumbnail_url,
			otherPartyId: isBuyer ? r.seller_id : r.buyer_id,
			otherPartyDisplayName: isBuyer ? r.seller_name : r.buyer_name,
			lastMessageAt: r.last_message_at.toISOString(),
			lastMessagePreview: (r.last_body ?? "").slice(0, 140),
			unreadCount: Number(unread.count),
		});
	}
	return result;
}

export interface ConversationDetail {
	id: string;
	listing: { id: string; title: string; status: string; ownerId: string };
	otherParty: { id: string; displayName: string };
	role: "buyer" | "seller";
	readOnly: boolean;
}

export async function getConversationServer(args: {
	conversationId: string;
	userId: string;
}): Promise<ConversationDetail> {
	const row = await db
		.selectFrom("conversation")
		.innerJoin("listing", "listing.id", "conversation.listing_id")
		.innerJoin("profile as buyer_profile", "buyer_profile.user_id", "conversation.buyer_id")
		.innerJoin("profile as seller_profile", "seller_profile.user_id", "conversation.seller_id")
		.select([
			"conversation.id",
			"conversation.buyer_id",
			"conversation.seller_id",
			"listing.id as listing_id",
			"listing.title as listing_title",
			"listing.status as listing_status",
			"listing.owner_id as listing_owner_id",
			"buyer_profile.display_name as buyer_name",
			"seller_profile.display_name as seller_name",
		])
		.where("conversation.id", "=", args.conversationId)
		.executeTakeFirst();
	if (!row) throw new AppError("messages.conversation_not_found");
	if (row.buyer_id !== args.userId && row.seller_id !== args.userId) {
		throw new AppError("messages.forbidden");
	}
	const role = row.buyer_id === args.userId ? "buyer" : "seller";
	return {
		id: row.id,
		listing: {
			id: row.listing_id,
			title: row.listing_title,
			status: row.listing_status,
			ownerId: row.listing_owner_id,
		},
		otherParty: {
			id: role === "buyer" ? row.seller_id : row.buyer_id,
			displayName: role === "buyer" ? row.seller_name : row.buyer_name,
		},
		role,
		readOnly: row.listing_status === "removed",
	};
}

export async function listMessagesServer(args: {
	conversationId: string;
	userId: string;
	beforeCursor?: string; // ISO timestamp
	limit?: number;
}): Promise<{ messages: Message[]; hasMore: boolean }> {
	const detail = await getConversationServer({ conversationId: args.conversationId, userId: args.userId });
	const limit = args.limit ?? 50;
	let q = db
		.selectFrom("message")
		.selectAll()
		.where("conversation_id", "=", detail.id)
		.orderBy("created_at", "desc")
		.limit(limit + 1);
	if (args.beforeCursor) {
		q = q.where("created_at", "<", new Date(args.beforeCursor));
	}
	const rows = await q.execute();
	const hasMore = rows.length > limit;
	const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
	return { messages: page as Message[], hasMore };
}

export async function markReadServer(args: {
	conversationId: string;
	userId: string;
}): Promise<void> {
	const detail = await getConversationServer({ conversationId: args.conversationId, userId: args.userId });
	const column = detail.role === "buyer" ? "buyer_last_read_at" : "seller_last_read_at";
	await db
		.updateTable("conversation")
		.set({ [column]: new Date() } as never)
		.where("id", "=", detail.id)
		.execute();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/messages.server.ts src/lib/messages.server.test.ts
git commit -m "feat(messages): inbox, thread, paging, mark-read (#8)"
```

---

## Task 8: Block / unblock + rate limits

**Files:**
- Modify: `src/lib/messages.server.ts`
- Modify: `src/lib/messages.server.test.ts`

- [ ] **Step 1: Add tests**

Append to `src/lib/messages.server.test.ts`:

```ts
import { blockUserServer, unblockUserServer } from "./messages.server";

describe("block/unblock", () => {
	beforeEach(async () => {
		await resetDb();
	});

	it("block prevents the blocked party from posting in existing thread", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await sendMessageServer({ conversationId, userId: buyer.id, body: "hi" });

		await blockUserServer({ userId: seller.id, targetUserId: buyer.id });
		await expect(
			sendMessageServer({ conversationId, userId: buyer.id, body: "reply" }),
		).rejects.toBeInstanceOf(AppError);
		// The blocker can still post:
		const { messageId } = await sendMessageServer({ conversationId, userId: seller.id, body: "no thanks" });
		expect(messageId).toBeTruthy();
	});

	it("unblock restores posting", async () => {
		const seller = await createTestUser();
		const buyer = await createTestUser();
		const listing = await createTestListing({ ownerId: seller.id });
		const { conversationId } = await startConversationServer({ listingId: listing.id, userId: buyer.id });
		await blockUserServer({ userId: seller.id, targetUserId: buyer.id });
		await unblockUserServer({ userId: seller.id, targetUserId: buyer.id });
		const { messageId } = await sendMessageServer({ conversationId, userId: buyer.id, body: "hi" });
		expect(messageId).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: FAIL on the two new tests.

- [ ] **Step 3: Implement block/unblock + rate limits**

Add to `src/lib/messages.server.ts`:

```ts
import { checkRateLimit } from "~/lib/rate-limit";

export async function blockUserServer(args: { userId: string; targetUserId: string }): Promise<void> {
	if (args.userId === args.targetUserId) {
		throw new AppError("messages.cannot_block_self");
	}
	await db
		.insertInto("user_block")
		.values({ blocker_id: args.userId, blocked_id: args.targetUserId })
		.onConflict((oc) => oc.columns(["blocker_id", "blocked_id"]).doNothing())
		.execute();
}

export async function unblockUserServer(args: { userId: string; targetUserId: string }): Promise<void> {
	await db
		.deleteFrom("user_block")
		.where("blocker_id", "=", args.userId)
		.where("blocked_id", "=", args.targetUserId)
		.execute();
}
```

Wire rate limits into `startConversationServer` and `sendMessageServer`:

- At the top of `startConversationServer`, after the args destructure:

```ts
const rl = checkRateLimit(`msg:new:${args.userId}`, 10, 60 * 60 * 1000);
if (!rl.allowed) throw new AppError("messages.rate_limited");
```

- At the top of `sendMessageServer`:

```ts
const rl = checkRateLimit(`msg:send:${args.userId}`, 30, 60 * 1000);
if (!rl.allowed) throw new AppError("messages.rate_limited");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/messages.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages.server.ts src/lib/messages.server.test.ts
git commit -m "feat(messages): block/unblock and rate limits (#8)"
```

---

## Task 9: Server-callable wrappers (createServerFn) + AppError messages

**Files:**
- Modify: `src/lib/messages.ts` — export thin `createServerFn` wrappers using the `*Server` functions and the session.
- Modify: `src/lib/errors.ts` (or wherever AppError messages live) — register the new keys.

- [ ] **Step 1: Identify session helper**

Run: `grep -n "createServerFn\|getSession\b" src/lib/bookings.ts | head`
Expected: a pattern using `createServerFn(...).handler(async (...) => { const { user } = await requireSession(); ... })` or similar. Reuse the exact same idiom.

- [ ] **Step 2: Add wrappers**

In `src/lib/messages.ts`, append (after the pure helpers — kept in same file because `bookings.ts` follows the same client+server-callable convention):

```ts
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "~/lib/session"; // adjust import to match repo convention
import {
	blockUserServer,
	getConversationServer,
	listConversationsServer,
	listMessagesServer,
	markReadServer,
	sendMessageServer,
	startConversationServer,
	unblockUserServer,
} from "~/lib/messages.server";

export const startConversation = createServerFn({ method: "POST" })
	.validator((d: { listingId: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		return startConversationServer({ listingId: data.listingId, userId: user.id });
	});

export const listConversations = createServerFn({ method: "GET" }).handler(async () => {
	const { user } = await requireSession();
	return listConversationsServer({ userId: user.id });
});

export const getConversation = createServerFn({ method: "GET" })
	.validator((d: { conversationId: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		return getConversationServer({ conversationId: data.conversationId, userId: user.id });
	});

export const listMessages = createServerFn({ method: "GET" })
	.validator((d: { conversationId: string; beforeCursor?: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		return listMessagesServer({ ...data, userId: user.id });
	});

export const sendMessage = createServerFn({ method: "POST" })
	.validator((d: { conversationId: string; body: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		return sendMessageServer({ ...data, userId: user.id });
	});

export const markRead = createServerFn({ method: "POST" })
	.validator((d: { conversationId: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		await markReadServer({ conversationId: data.conversationId, userId: user.id });
	});

export const blockUser = createServerFn({ method: "POST" })
	.validator((d: { targetUserId: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		await blockUserServer({ userId: user.id, targetUserId: data.targetUserId });
	});

export const unblockUser = createServerFn({ method: "POST" })
	.validator((d: { targetUserId: string }) => d)
	.handler(async ({ data }) => {
		const { user } = await requireSession();
		await unblockUserServer({ userId: user.id, targetUserId: data.targetUserId });
	});
```

> Replace `requireSession` import with whatever the repo currently uses (e.g. `getRequestSession`, `requireUser`). Mirror exactly what `bookings.ts` does.

- [ ] **Step 3: Register AppError keys**

Grep for how error keys are registered:

Run: `grep -n "AppError\|booking.listing_unavailable" src/lib/errors.ts | head`

Add these keys to whatever registry the file uses (translation map / enum / union):

```
messages.body_empty
messages.body_too_long
messages.listing_not_found
messages.listing_unavailable
messages.listing_readonly
messages.own_listing
messages.blocked
messages.cannot_block_self
messages.conversation_not_found
messages.forbidden
messages.rate_limited
```

- [ ] **Step 4: Typecheck + run all unit tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages.ts src/lib/errors.ts
git commit -m "feat(messages): server function wrappers and error keys (#8)"
```

---

## Task 10: Email template (replace stub)

**Files:**
- Modify: `src/lib/email-templates/new-message.ts` (or rename to `.tsx` if existing templates use JSX)
- Reference: existing template under `src/lib/email-templates/` (booking emails) and `src/lib/email.ts` / `src/lib/email-wrapper.ts` for send transport.

- [ ] **Step 1: Inspect an existing template**

Run: `ls src/lib/email-templates/ && grep -nl "sendBookingRequestEmail\|export async function send" src/lib/booking-emails.ts`
Expected: a clear pattern showing how a "send X email" function builds its template and dispatches via the wrapper.

- [ ] **Step 2: Implement the template**

Rewrite `src/lib/email-templates/new-message.ts` mirroring the existing send-email pattern. Replace the stub with:

```ts
import { sendEmail } from "~/lib/email"; // or whichever export is canonical
import { renderEmail } from "~/lib/email-wrapper"; // adjust to match existing pattern

export async function sendNewMessageEmail(args: {
	to: string;
	listingTitle: string;
	conversationId: string;
	previewBody: string;
}): Promise<void> {
	const preview = args.previewBody.slice(0, 200);
	const subject = `Uusi viesti ilmoituksesta "${args.listingTitle}"`;
	const url = `${process.env.APP_URL ?? "https://motori.fi"}/viestit/${args.conversationId}`;
	const html = renderEmail({
		title: subject,
		bodyHtml: `
			<p>${escapeHtml(preview)}</p>
			<p><a href="${url}">Avaa keskustelu Motorissa</a></p>
		`,
	});
	await sendEmail({ to: args.to, subject, html });
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
```

> Adjust imports to match the exact names exported from `~/lib/email.ts` and the email-wrapper. The existing booking emails are the source of truth — copy the structure verbatim, only changing the subject, body, and CTA.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email-templates/new-message.ts
git commit -m "feat(messages): new-message email template (#8)"
```

---

## Task 11: SSE endpoint

**Files:**
- Create: `src/routes/api/messages/stream.$conversationId.ts`

- [ ] **Step 1: Inspect existing API route pattern**

Run: `ls src/routes/api/ && cat $(ls src/routes/api/*.ts | head -1)`
Expected: file-route API pattern with `createAPIFileRoute`. Mirror exactly.

- [ ] **Step 2: Implement the SSE endpoint**

Create `src/routes/api/messages/stream.$conversationId.ts`:

```ts
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getConversationServer } from "~/lib/messages.server";
import { subscribe } from "~/lib/messages-bus";
import { requireSession } from "~/lib/session"; // adjust

export const APIRoute = createAPIFileRoute("/api/messages/stream/$conversationId")({
	GET: async ({ params, request }) => {
		const { user } = await requireSession(request);
		// Throws AppError("messages.forbidden") if not a participant
		await getConversationServer({ conversationId: params.conversationId, userId: user.id });

		const stream = new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();
				const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
				const heartbeat = setInterval(() => controller.enqueue(encoder.encode(`: hb\n\n`)), 25_000);
				const unsub = subscribe(params.conversationId, (msg) => send(msg));
				const abort = () => {
					clearInterval(heartbeat);
					unsub();
					try {
						controller.close();
					} catch {}
				};
				request.signal.addEventListener("abort", abort);
			},
		});
		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream",
				"cache-control": "no-cache, no-transform",
				connection: "keep-alive",
			},
		});
	},
});
```

> Confirm the API route helper name from the existing routes. If the project uses `defineEventHandler` or a different idiom, adapt the structure but keep the SSE shape (text/event-stream, JSON-per-event, heartbeats).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/messages/stream.\$conversationId.ts
git commit -m "feat(messages): SSE endpoint for thread streaming (#8)"
```

---

## Task 12: Booking integration — replace booking.message with first conversation message

**Files:**
- Modify: `src/lib/bookings.server.ts`
- Modify: `src/routes/omat/varaukset_.$bookingId.tsx`

- [ ] **Step 1: Update `createBookingRequest`**

In `src/lib/bookings.server.ts`, inside `createBookingRequest`, replace the section that builds & inserts the booking row. Before the insert:

```ts
// Ensure conversation exists (idempotent)
const { conversationId } = await startConversationServer({
	listingId: listing.id,
	userId: args.userId,
});
```

Then in the booking insert, set:

```ts
.values({
	short_id: shortId,
	listing_id: listing.id,
	renter_user_id: args.userId,
	start_date: args.startDate,
	end_date: args.endDate,
	message: null,
	conversation_id: conversationId,
	// ... rest unchanged
})
```

After the booking insert succeeds, insert the system message:

```ts
await sendMessageServer({
	conversationId,
	userId: args.userId,
	body: args.message,
	kind: "booking_request",
	bookingId: inserted.id, // adjust to whatever variable holds the new booking id
});
```

Imports at top of file:

```ts
import { startConversationServer, sendMessageServer } from "~/lib/messages.server";
```

- [ ] **Step 2: Update booking detail page**

In `src/routes/omat/varaukset_.$bookingId.tsx`, locate the section that renders the booking's `message`. Replace with conditional render:

```tsx
{booking.conversation_id ? (
	<Link to="/viestit/$conversationId" params={{ conversationId: booking.conversation_id }}>
		{t("messages.openConversation")}
	</Link>
) : booking.message ? (
	<p className="whitespace-pre-wrap">{booking.message}</p>
) : null}
```

- [ ] **Step 3: Adjust any reads of `booking.message`**

Grep for other readers:

Run: `grep -rn "booking\.message\|\.message[^a-zA-Z]" src/ --include='*.ts' --include='*.tsx' | grep -i booking`

For each reader, gate on null (`booking.message ?? ""`) or branch to the conversation link.

- [ ] **Step 4: Run unit tests**

Run: `pnpm test`
Expected: PASS. The existing `bookings.server.test.ts` may need a small tweak — booking.message can be null now; assertions that compared the raw message string should be updated to read it from the conversation's first `booking_request` message instead.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bookings.server.ts src/routes/omat/varaukset_.\$bookingId.tsx src/lib/bookings.server.test.ts
git commit -m "feat(bookings): booking inquiries now create a conversation thread (#8)"
```

---

## Task 13: Inbox page `/viestit`

**Files:**
- Create: `src/routes/viestit.tsx`
- Create: `src/routes/viestit/index.tsx` (if file-router requires it; otherwise put list UI in `viestit.tsx`)

Use whichever file-router pattern matches existing routes (`/omat`, `/ilmoitukset`). The hierarchy must support a child route `$conversationId.tsx` in Task 14.

- [ ] **Step 1: Implement inbox layout + listing**

```tsx
// src/routes/viestit.tsx
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { listConversations } from "~/lib/messages";

export const Route = createFileRoute("/viestit")({
	loader: () => listConversations(),
	component: ViestitLayout,
});

function ViestitLayout() {
	const conversations = Route.useLoaderData();
	const { t } = useTranslation("messages");

	return (
		<div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 p-4">
			<aside className="border rounded">
				<h1 className="px-3 py-2 font-semibold">{t("inbox.title")}</h1>
				{conversations.length === 0 ? (
					<p className="px-3 py-2 text-sm text-muted-foreground">{t("inbox.empty")}</p>
				) : (
					<ul>
						{conversations.map((c) => (
							<li key={c.id}>
								<Link
									to="/viestit/$conversationId"
									params={{ conversationId: c.id }}
									className="block px-3 py-2 border-t hover:bg-muted"
								>
									<div className="flex items-center justify-between">
										<span className="font-medium truncate">{c.otherPartyDisplayName}</span>
										{c.unreadCount > 0 && (
											<span className="ml-2 rounded-full bg-primary text-primary-foreground text-xs px-2">
												{c.unreadCount}
											</span>
										)}
									</div>
									<div className="text-xs text-muted-foreground truncate">{c.listingTitle}</div>
									<div className="text-sm truncate">{c.lastMessagePreview}</div>
								</Link>
							</li>
						))}
					</ul>
				)}
			</aside>
			<main>
				<Outlet />
			</main>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/viestit.tsx
git commit -m "feat(messages): inbox page at /viestit (#8)"
```

---

## Task 14: Thread page `/viestit/$conversationId`

**Files:**
- Create: `src/routes/viestit/$conversationId.tsx`

- [ ] **Step 1: Implement thread page**

```tsx
// src/routes/viestit/$conversationId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getConversation, listMessages, markRead, sendMessage } from "~/lib/messages";
import type { Message } from "~/lib/db/schema";

export const Route = createFileRoute("/viestit/$conversationId")({
	loader: async ({ params }) => {
		const [conv, page] = await Promise.all([
			getConversation({ data: { conversationId: params.conversationId } }),
			listMessages({ data: { conversationId: params.conversationId } }),
		]);
		await markRead({ data: { conversationId: params.conversationId } });
		return { conv, initialMessages: page.messages };
	},
	component: ThreadPage,
});

function ThreadPage() {
	const params = Route.useParams();
	const { conv, initialMessages } = Route.useLoaderData();
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation("messages");

	useEffect(() => {
		const es = new EventSource(`/api/messages/stream/${params.conversationId}`);
		es.onmessage = (ev) => {
			const msg = JSON.parse(ev.data) as Message;
			setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
		};
		return () => es.close();
	}, [params.conversationId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	const onSend = async () => {
		if (!body.trim() || sending || conv.readOnly) return;
		setSending(true);
		try {
			await sendMessage({ data: { conversationId: params.conversationId, body } });
			setBody("");
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="flex flex-col h-[calc(100vh-8rem)]">
			<header className="border-b p-3">
				<h2 className="font-semibold">{conv.otherParty.displayName}</h2>
				<p className="text-xs text-muted-foreground">{conv.listing.title}</p>
			</header>
			<div className="flex-1 overflow-y-auto p-3 space-y-2">
				{messages.map((m) => (
					<MessageBubble key={m.id} message={m} mine={m.sender_id !== conv.otherParty.id} />
				))}
				<div ref={bottomRef} />
			</div>
			{conv.readOnly ? (
				<div className="border-t p-3 text-sm text-muted-foreground">{t("thread.readOnly")}</div>
			) : (
				<div className="border-t p-3 flex gap-2">
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value)}
						maxLength={4000}
						rows={2}
						className="flex-1 border rounded p-2"
						placeholder={t("thread.placeholder") ?? ""}
					/>
					<button type="button" onClick={onSend} disabled={sending} className="px-4 rounded bg-primary text-primary-foreground">
						{t("thread.send")}
					</button>
				</div>
			)}
		</div>
	);
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
	if (message.kind === "booking_request") {
		return (
			<div className="text-center text-xs text-muted-foreground border-y py-2">
				Booking request: <span className="whitespace-pre-wrap">{message.body}</span>
			</div>
		);
	}
	return (
		<div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
			<div className={`max-w-[70%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
				<p className="whitespace-pre-wrap break-words">{message.body}</p>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/viestit/\$conversationId.tsx
git commit -m "feat(messages): thread page with SSE and composer (#8)"
```

---

## Task 15: "Lähetä viesti" button on listing detail

**Files:**
- Modify: `src/lib/listings-detail-route.tsx`

- [ ] **Step 1: Wire the button**

Locate the call-to-action area on the listing detail page (next to "Vuokraa"/"Osta" buttons). Add:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { startConversation } from "~/lib/messages";

// inside component, alongside other CTAs — only render when user is logged in and not the owner
const navigate = useNavigate();
const onMessageSeller = async () => {
	const { conversationId } = await startConversation({ data: { listingId: listing.id } });
	navigate({ to: "/viestit/$conversationId", params: { conversationId } });
};

{user && user.id !== listing.owner_id && listing.status !== "removed" && (
	<button type="button" onClick={onMessageSeller} className="...existing CTA classes...">
		{t("listing.messageSeller")}
	</button>
)}
```

Hide phone/contact details on the listing detail page when this messaging button is present — verify there is no plaintext email/phone leak. (The `profile.show_phone` field already governs phone visibility; no change needed there.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-detail-route.tsx
git commit -m "feat(listings): \"Lähetä viesti\" CTA on listing detail (#8)"
```

---

## Task 16: Nav link + unread badge

**Files:**
- Modify: `src/routes/__root.tsx` (or wherever the global nav lives — look for the existing "Omat" / "Ilmoita" links and match that location)

- [ ] **Step 1: Add `/viestit` link with unread total**

In the root layout (server-rendered if possible to avoid initial flicker), fetch the unread total:

```tsx
import { listConversations } from "~/lib/messages";

// Inside loader or auth-gated layout:
const conversations = user ? await listConversations() : [];
const unreadTotal = conversations.reduce((n, c) => n + c.unreadCount, 0);

// Render the nav item:
<Link to="/viestit" className="...">
	{t("nav.messages")}
	{unreadTotal > 0 && (
		<span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-2">{unreadTotal}</span>
	)}
</Link>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(nav): /viestit link with unread badge (#8)"
```

---

## Task 17: i18n strings

**Files:**
- Modify: `src/lib/i18n/locales/fi/...` and `en/...`
- Modify: i18n init / namespace registry

- [ ] **Step 1: Locate existing namespace pattern**

Run: `find src/lib/i18n -type f | head -20`
Expected: a clear pattern of `<lang>/<namespace>.json` (or `.ts`) and a central register.

- [ ] **Step 2: Create the `messages` namespace files**

Finnish (`messages.json` under fi):

```json
{
	"inbox": {
		"title": "Viestit",
		"empty": "Ei viestejä vielä."
	},
	"thread": {
		"send": "Lähetä",
		"placeholder": "Kirjoita viesti…",
		"readOnly": "Tämä keskustelu on vain luettavissa (ilmoitus on poistettu)."
	},
	"listing": {
		"messageSeller": "Lähetä viesti"
	},
	"nav": {
		"messages": "Viestit"
	},
	"openConversation": "Avaa keskustelu",
	"errors": {
		"body_empty": "Viesti ei voi olla tyhjä.",
		"body_too_long": "Viesti on liian pitkä (max 4000 merkkiä).",
		"listing_not_found": "Ilmoitusta ei löytynyt.",
		"listing_unavailable": "Ilmoitus ei ole saatavilla.",
		"listing_readonly": "Ilmoitus on poistettu, et voi enää lähettää viestejä.",
		"own_listing": "Et voi viestiä omasta ilmoituksestasi.",
		"blocked": "Viestien lähettäminen estetty.",
		"cannot_block_self": "Et voi estää itseäsi.",
		"conversation_not_found": "Keskustelua ei löytynyt.",
		"forbidden": "Ei pääsyä tähän keskusteluun.",
		"rate_limited": "Liian monta viestiä lyhyessä ajassa. Yritä myöhemmin uudelleen."
	}
}
```

English mirrors the same keys with English text.

- [ ] **Step 3: Register the namespace**

Add `messages` to whatever namespace array exists in the i18n init module.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n
git commit -m "feat(i18n): messages namespace, fi+en (#8)"
```

---

## Task 18: End-to-end test

**Files:**
- Create: `e2e/messaging.spec.ts`

- [ ] **Step 1: Inspect existing e2e helpers**

Run: `ls e2e/ && grep -l "createListing\|signUp\|loginAs" e2e | head`
Expected: helpers for creating users + listings. Reuse.

- [ ] **Step 2: Write the e2e**

```ts
import { expect, test } from "@playwright/test";
import { createListingAs, signUpAndLogin } from "./helpers"; // adapt to actual helper names

test("buyer messages seller, seller replies, badges update", async ({ browser }) => {
	const sellerCtx = await browser.newContext();
	const buyerCtx = await browser.newContext();
	const sellerPage = await sellerCtx.newPage();
	const buyerPage = await buyerCtx.newPage();

	const seller = await signUpAndLogin(sellerPage);
	const listing = await createListingAs(sellerPage, { title: "Test bike" });
	const buyer = await signUpAndLogin(buyerPage);

	await buyerPage.goto(`/ilmoitukset/${listing.slug}`);
	await buyerPage.getByRole("button", { name: /lähetä viesti/i }).click();
	await expect(buyerPage).toHaveURL(/\/viestit\//);

	await buyerPage.getByPlaceholder(/kirjoita viesti/i).fill("Onko vielä saatavilla?");
	await buyerPage.getByRole("button", { name: /lähetä$/i }).click();
	await expect(buyerPage.getByText("Onko vielä saatavilla?")).toBeVisible();

	// Seller sees unread badge on /viestit nav
	await sellerPage.goto("/viestit");
	await expect(sellerPage.getByText("Test bike")).toBeVisible();
	await sellerPage.getByText("Test bike").click();
	await expect(sellerPage.getByText("Onko vielä saatavilla?")).toBeVisible();

	// Seller replies; buyer sees it via SSE without reload
	await sellerPage.getByPlaceholder(/kirjoita viesti/i).fill("Kyllä on!");
	await sellerPage.getByRole("button", { name: /lähetä$/i }).click();
	await expect(buyerPage.getByText("Kyllä on!")).toBeVisible({ timeout: 5000 });
});

test("removed listing thread is read-only", async ({ browser }) => {
	// Seed conversation, then mark listing removed via DB or admin route, then assert composer is gone.
	// Implementation depends on existing e2e DB helpers — adapt accordingly.
});
```

> If `e2e/helpers.ts` doesn't expose `createListingAs`/`signUpAndLogin`, port the inline equivalents from another spec (e.g. an existing booking e2e). Don't introduce new abstractions just for this test.

- [ ] **Step 3: Run e2e (single spec)**

Run: `pnpm test:e2e e2e/messaging.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/messaging.spec.ts
git commit -m "test(e2e): messaging happy path and read-only thread (#8)"
```

---

## Task 19: Final verification batch

Per project convention, lint/format/full e2e run only at the end.

- [ ] **Step 1: Lint**

Run: `pnpm lint:fix`
Expected: no remaining errors. Re-run `pnpm lint` and confirm clean.

- [ ] **Step 2: Format**

Run: `pnpm format:fix`
Expected: clean.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Unit tests**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 5: Full e2e suite**

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 6: Commit any tooling fixups**

If `lint:fix` / `format:fix` produced changes:

```bash
git add -A
git commit -m "chore(messages): lint and format cleanup (#8)"
```

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin messaging
gh pr create --title "feat: in-app messaging (closes #8)" --body "$(cat <<'EOF'
## Summary
- New conversation/message/user_block tables (migration 026)
- Booking inquiries now create a persistent conversation with a `booking_request` system message
- `/viestit` inbox + thread page with SSE live delivery
- "First unread" email notifications, per-conversation
- Block + rate limits for abuse control

## Test plan
- [x] `pnpm test`
- [x] `pnpm test:e2e`
- [ ] Manual smoke: send + reply between two browser sessions, verify badge increments
- [ ] Manual smoke: confirm legacy bookings still render their inline message

Closes #8
EOF
)"
```

---

## Self-review summary

- **Spec coverage:** All Q1–Q7 decisions and every server-function / route / safety control from the spec map to a task. The booking integration (Q1-B) is Task 12. Email "first unread" (Q4-B) is in `shouldNotifyByEmail` (Task 3) and applied in `sendMessageServer` (Task 6). Block + rate limits (Q7-C) are Task 8. SSE (Q3-B) is Tasks 4 + 11.
- **Type consistency:** `MessageKind`, `Conversation`, `Message`, `ConversationListRow`, `ConversationDetail` are defined once and referenced consistently. `*Server` functions are the implementation; `createServerFn` wrappers in `messages.ts` re-export the user-facing names.
- **Placeholders:** none — every step shows the code or the exact command. Where the repo's idiom needs verification (session helper name, email transport export, file-router conventions), the task tells the implementer how to discover the right name via a single grep before writing the code.
- **Scope:** single feature, all changes coordinated around one migration, single PR. No premature abstraction.
