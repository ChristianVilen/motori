# Messaging PR Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in code review of the messaging PR before merge — N+1 query, block-check ambiguity, email idempotency, Zod validation, migration rollback, and minor Biome/guard issues.

**Architecture:** Each task is a self-contained fix. Tests run with `pnpm test` (vitest), e2e with `pnpm test:e2e`. Lint/format with `pnpm lint:fix && pnpm format:fix`.

**Tech Stack:** TanStack Start, Kysely, Vitest, Playwright, Zod, Biome

---

## File Map

| File | Change |
|------|--------|
| `src/lib/messages.server.ts` | Fix N+1 unread count, fix block check, add messageId to email call |
| `src/lib/messages.server.test.ts` | New tests for block fix, N+1 query shape |
| `src/lib/email-templates/new-message.ts` | Add `messageId` param, fix idempotency key |
| `src/lib/messages.ts` | Add Zod validation to inputValidator callbacks |
| `src/lib/db/migrations/026_conversations.ts` | Fix down() rollback — backfill before NOT NULL |
| `src/components/listings/non-rental-sidebar.tsx` | Fix Biome noLeakedRender |
| `src/routes/viestit/$conversationId.tsx` | Fix Biome useExhaustiveDependencies |
| `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx` | Explicit `!isOwner` guard on message button |

---

## Task 1: Fix N+1 — move unread count into the main query

**Files:**
- Modify: `src/lib/messages.server.ts:228–292`

The `listConversationsServer` function currently fires one `COUNT` query per conversation row in a loop. This also hits the root loader via `getUnreadTotal` on every page load. Fix by replacing the loop with a correlated subquery in the main select, following the same pattern as `last_body`.

- [ ] **Step 1: Understand current shape**

Current (N+1):
```ts
// messages.server.ts:239–258 — main query selects these columns:
eb.selectFrom("message").select("body")...as("last_body"),
// Then a loop fires COUNT queries:
const unread = await db.selectFrom("message").select(countAll).where(...)
```

- [ ] **Step 2: Rewrite `listConversationsServer` to use a correlated unread subquery**

Replace the entire `listConversationsServer` function in `src/lib/messages.server.ts`:

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
			eb
				.selectFrom("message")
				.select(eb.fn.countAll<string>().as("cnt"))
				.whereRef("conversation_id", "=", "conversation.id")
				.where("sender_id", "<>", args.userId)
				.where((eb2) =>
					eb2.or([
						eb2("conversation.buyer_id", "<>", args.userId),
						eb2.and([
							eb2("conversation.buyer_id", "=", args.userId),
							eb2(
								"created_at",
								">",
								eb2
									.ref("conversation.buyer_last_read_at")
									.$castTo<Date>(),
							),
						]),
					]),
				)
				.as("unread_count_raw"),
		])
		.where((eb) =>
			eb.or([
				eb("conversation.buyer_id", "=", args.userId),
				eb("conversation.seller_id", "=", args.userId),
			]),
		)
		.orderBy("conversation.last_message_at", "desc")
		.execute();

	return rows.map((r) => {
		const isBuyer = r.buyer_id === args.userId;
		const lastReadAt = isBuyer ? r.buyer_last_read_at : r.seller_last_read_at;
		// Correlated subquery can't easily use the dynamic lastReadAt per row,
		// so we still need the conditional unread count — but in one query pass.
		// The `unread_count_raw` above counts all unread from non-self sender,
		// filtered by last_read_at only if the user is the buyer column.
		// For sellers, we need a separate filter. Use a simpler approach: keep
		// the correlated subquery for last_body (proven pattern) and compute
		// unread with a LEFT JOIN LATERAL equivalent using a CASE in a subquery.
		// See Step 3 for the correct implementation.
		return {
			id: r.id,
			listingId: r.listing_id,
			listingTitle: r.listing_title,
			listingThumbnailUrl: r.listing_thumbnail_url,
			otherPartyId: isBuyer ? r.seller_id : r.buyer_id,
			otherPartyDisplayName: isBuyer ? r.seller_name : r.buyer_name,
			lastMessageAt: r.last_message_at.toISOString(),
			lastMessagePreview: (r.last_body ?? "").slice(0, 140),
			unreadCount: Number(r.unread_count_raw ?? 0),
		};
	});
}
```

Step 2 above is a stepping stone — the correlated unread subquery in Kysely can't easily reference `buyer_last_read_at` vs `seller_last_read_at` dynamically per-row inside the subquery. The correct approach is a single pass with raw SQL for the conditional.

- [ ] **Step 3: Use the correct single-query approach**

Replace `listConversationsServer` with this version that computes unread correctly for both buyer and seller in one query using a `CASE`-based correlated subquery:

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
			sql<string>`(
				SELECT count(*)
				FROM message
				WHERE conversation_id = conversation.id
				  AND sender_id <> ${sql.val(args.userId)}
				  AND (
				    CASE
				      WHEN conversation.buyer_id = ${sql.val(args.userId)}
				        THEN (conversation.buyer_last_read_at IS NULL OR created_at > conversation.buyer_last_read_at)
				      ELSE (conversation.seller_last_read_at IS NULL OR created_at > conversation.seller_last_read_at)
				    END
				  )
			)`.as("unread_count"),
		])
		.where((eb) =>
			eb.or([
				eb("conversation.buyer_id", "=", args.userId),
				eb("conversation.seller_id", "=", args.userId),
			]),
		)
		.orderBy("conversation.last_message_at", "desc")
		.execute();

	return rows.map((r) => {
		const isBuyer = r.buyer_id === args.userId;
		return {
			id: r.id,
			listingId: r.listing_id,
			listingTitle: r.listing_title,
			listingThumbnailUrl: r.listing_thumbnail_url,
			otherPartyId: isBuyer ? r.seller_id : r.buyer_id,
			otherPartyDisplayName: isBuyer ? r.seller_name : r.buyer_name,
			lastMessageAt: r.last_message_at.toISOString(),
			lastMessagePreview: (r.last_body ?? "").slice(0, 140),
			unreadCount: Number(r.unread_count ?? 0),
		};
	});
}
```

Note: `sql` is already imported at the top of `messages.server.ts` via `import { db } from "~/lib/db/index"`. Check that `sql` is imported from `kysely` — if not, add:
```ts
import { sql } from "kysely";
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```
Expected: no new errors.

- [ ] **Step 5: Run existing unit tests to confirm no regression**

```bash
pnpm test src/lib/messages.server.test.ts
```
Expected: all pass (the unit tests mock the DB so won't catch query changes — that's fine, the e2e will).

- [ ] **Step 6: Commit**

```bash
git add src/lib/messages.server.ts
git commit -m "fix(messages): replace N+1 unread count loop with correlated subquery"
```

---

## Task 2: Fix block-check ambiguity in `sendMessageServer`

**Files:**
- Modify: `src/lib/messages.server.ts:149–161`
- Modify: `src/lib/messages.server.test.ts`

The current check `if (block && block.blocker_id !== args.userId)` allows the blocker to still send messages after blocking. When both users have blocked each other, `executeTakeFirst` returns a non-deterministic row. Fix: `if (block)` — any block in either direction prevents both parties from sending.

- [ ] **Step 1: Write failing test for sender-is-blocker case**

Add this test inside `describe("sendMessageServer", ...)` in `src/lib/messages.server.test.ts`. Find the end of that describe block (after the `listing_readonly` test, before `describe("block/unblock guards")`):

```ts
it("throws blocked when the sender is the blocker", async () => {
    // conversation found, sender is participant
    executeTakeFirstQueue.push({
        id: "C1",
        buyer_id: "U1",
        seller_id: "S",
        buyer_last_read_at: null,
        seller_last_read_at: null,
        listing_id: "L1",
        listing_title: "Bike",
        listing_status: "active",
        buyer_email: "u1@example.com",
        buyer_email_verified: true,
        seller_email: "s@example.com",
        seller_email_verified: true,
        buyer_language: "fi",
        seller_language: "fi",
    });
    // block row: U1 is the blocker
    executeTakeFirstQueue.push({ blocker_id: "U1" });

    await expect(
        sendMessageServer({ conversationId: "C1", userId: "U1", body: "hello" }),
    ).rejects.toMatchObject({ code: "messages.blocked" });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/lib/messages.server.test.ts
```
Expected: the new test FAILS (current code allows sender-is-blocker to send).

- [ ] **Step 3: Fix the block check**

In `src/lib/messages.server.ts`, change line 159:

```ts
// Before:
if (block && block.blocker_id !== args.userId) {
    throw new AppError("messages.blocked");
}

// After:
if (block) {
    throw new AppError("messages.blocked");
}
```

Since we no longer need `blocker_id` from the block row, also simplify the select:

```ts
const block = await db
    .selectFrom("user_block")
    .select("blocker_id")   // keep for now — removing would require schema change
    .where((eb) =>
        eb.or([
            eb.and([eb("blocker_id", "=", conv.buyer_id), eb("blocked_id", "=", conv.seller_id)]),
            eb.and([eb("blocker_id", "=", conv.seller_id), eb("blocked_id", "=", conv.buyer_id)]),
        ]),
    )
    .executeTakeFirst();
if (block) {
    throw new AppError("messages.blocked");
}
```

- [ ] **Step 4: Run tests to verify fix**

```bash
pnpm test src/lib/messages.server.test.ts
```
Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messages.server.ts src/lib/messages.server.test.ts
git commit -m "fix(messages): any block prevents sending in either direction"
```

---

## Task 3: Fix email idempotency key

**Files:**
- Modify: `src/lib/email-templates/new-message.ts`
- Modify: `src/lib/messages.server.ts:211–223`

`Date.now()` in the idempotency key defeats its purpose — duplicate emails are sent on retry. Fix: pass `messageId` from the inserted message row into `sendNewMessageEmail`.

- [ ] **Step 1: Update `sendNewMessageEmail` signature**

In `src/lib/email-templates/new-message.ts`, add `messageId` to the args and use it in the key:

```ts
export async function sendNewMessageEmail(args: {
    to: string;
    listingTitle: string;
    conversationId: string;
    messageId: string;
    previewBody: string;
    language?: "fi" | "en";
}): Promise<void> {
    const lang = args.language ?? "fi";
    const t = getEmailT(lang);
    const url = `${SITE_URL}/viestit/${args.conversationId}`;
    const safeTitle = escapeHtml(args.listingTitle);
    const safePreview = escapeHtml(args.previewBody.slice(0, 300));

    await sendEmail({
        to: args.to,
        subject: t("newMessage.subject", { title: args.listingTitle }),
        html: wrapEmail(
            `
            <p>${t("newMessage.intro", { title: safeTitle })}</p>
            <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;white-space:pre-wrap">${safePreview}</blockquote>
            <p>${t("newMessage.cta")}<br><a href="${url}">${url}</a></p>
        `,
            lang,
        ),
        text: `${t("newMessage.intro", { title: args.listingTitle })}\n\n${url}`,
        idempotencyKey: `new-message/${args.conversationId}/${args.messageId}`,
    });
}
```

- [ ] **Step 2: Pass `messageId` at the call site**

In `src/lib/messages.server.ts`, the `sendNewMessageEmail` call is around line 211. Update it to pass `messageId: inserted.id`:

```ts
void sendNewMessageEmail({
    to: recipientEmail,
    listingTitle: conv.listing_title,
    conversationId: conv.id,
    messageId: inserted.id,
    previewBody: trimmedBody,
    language: (recipientIsBuyer ? conv.buyer_language : conv.seller_language) as "fi" | "en",
}).catch((err) =>
    log.error("messages.email_failed", {
        error: String(err),
        conversationId: conv.id,
    }),
);
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/email-templates/new-message.ts src/lib/messages.server.ts
git commit -m "fix(messages): stable email idempotency key using messageId"
```

---

## Task 4: Add Zod validation to server function inputValidators

**Files:**
- Modify: `src/lib/messages.ts`

The `inputValidator` callbacks currently use TypeScript type annotations with pass-through (`(d: T) => d`), which means any value passes at runtime. Add Zod schemas to match the pattern used in the rest of the codebase.

- [ ] **Step 1: Add `z` import**

At the top of `src/lib/messages.ts`, add the Zod import (after the existing imports):

```ts
import { z } from "zod";
```

- [ ] **Step 2: Replace inputValidator callbacks**

In `src/lib/messages.ts`, update each server function's `inputValidator`:

```ts
export const startConversation = createServerFn({ method: "POST" })
    .middleware([csrfMiddleware()])
    .inputValidator((d: unknown) => z.object({ listingId: z.string().min(1) }).parse(d))
    .handler(async ({ data }) =>
        startConversationServer({ listingId: data.listingId, userId: await requireUserId() }),
    );

export const listConversations = createServerFn({ method: "GET" }).handler(async () =>
    listConversationsServer({ userId: await requireUserId() }),
);

export const getUnreadTotal = createServerFn({ method: "GET" }).handler(async () => {
    const session = await getSession();
    if (!session) {
        return { unread: 0 };
    }
    const rows = await listConversationsServer({ userId: session.user.id });
    return { unread: rows.reduce((n, c) => n + c.unreadCount, 0) };
});

export const getConversation = createServerFn({ method: "GET" })
    .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
    .handler(async ({ data }) =>
        getConversationServer({ conversationId: data.conversationId, userId: await requireUserId() }),
    );

export const listMessages = createServerFn({ method: "GET" })
    .inputValidator((d: unknown) =>
        z.object({ conversationId: z.string().uuid(), beforeCursor: z.string().optional() }).parse(d),
    )
    .handler(async ({ data }) =>
        listMessagesServer({ ...data, userId: await requireUserId() }),
    );

export const sendMessage = createServerFn({ method: "POST" })
    .middleware([csrfMiddleware()])
    .inputValidator((d: unknown) =>
        z.object({ conversationId: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
    )
    .handler(async ({ data }) =>
        sendMessageServer({ ...data, userId: await requireUserId() }),
    );

export const markRead = createServerFn({ method: "POST" })
    .middleware([csrfMiddleware()])
    .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
    .handler(async ({ data }) => {
        await markReadServer({ conversationId: data.conversationId, userId: await requireUserId() });
    });

export const blockUser = createServerFn({ method: "POST" })
    .middleware([csrfMiddleware()])
    .inputValidator((d: unknown) => z.object({ targetUserId: z.string().min(1) }).parse(d))
    .handler(async ({ data }) => {
        await blockUserServer({ userId: await requireUserId(), targetUserId: data.targetUserId });
    });

export const unblockUser = createServerFn({ method: "POST" })
    .middleware([csrfMiddleware()])
    .inputValidator((d: unknown) => z.object({ targetUserId: z.string().min(1) }).parse(d))
    .handler(async ({ data }) => {
        await unblockUserServer({ userId: await requireUserId(), targetUserId: data.targetUserId });
    });
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors. If TanStack Start's `inputValidator` type inference narrows `data` from the return type, all `.handler` usages should still compile.

- [ ] **Step 4: Commit**

```bash
git add src/lib/messages.ts
git commit -m "fix(messages): add Zod runtime validation to server function inputs"
```

---

## Task 5: Fix migration down() — backfill before NOT NULL

**Files:**
- Modify: `src/lib/db/migrations/026_conversations.ts`

The `down()` function attempts to restore `booking.message SET NOT NULL`, but rows inserted after `up()` ran have `message = NULL`. This causes the rollback to fail on a live DB.

- [ ] **Step 1: Add backfill step to `down()`**

In `src/lib/db/migrations/026_conversations.ts`, update the `down()` function:

```ts
export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP INDEX IF EXISTS booking_conversation_id_idx`.execute(db);
    await sql`UPDATE booking SET message = '' WHERE message IS NULL`.execute(db);
    await sql`ALTER TABLE booking ALTER COLUMN message SET NOT NULL`.execute(db);
    await sql`ALTER TABLE booking DROP COLUMN conversation_id`.execute(db);
    await sql`DROP TABLE user_block`.execute(db);
    await sql`DROP TABLE message`.execute(db);
    await sql`DROP TABLE conversation`.execute(db);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/migrations/026_conversations.ts
git commit -m "fix(migrations): backfill message='' before restoring NOT NULL in 026 down"
```

---

## Task 6: Fix Biome issues and implicit owner guard

**Files:**
- Modify: `src/components/listings/non-rental-sidebar.tsx`
- Modify: `src/routes/viestit/$conversationId.tsx`
- Modify: `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`

Three independent fixes in this task.

### 6a: `noLeakedRender` in non-rental-sidebar

- [ ] **Step 1: Fix the `&&` render to a ternary**

In `src/components/listings/non-rental-sidebar.tsx`, change lines 97–105:

```tsx
// Before:
{showMessageButton && (
    <button
        type="button"
        onClick={onMessageSeller}
        className="mt-2 block w-full rounded-lg border border-accent px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-accent/5"
    >
        {t("detail.messageSeller", "Lähetä viesti")}
    </button>
)}

// After:
{showMessageButton ? (
    <button
        type="button"
        onClick={onMessageSeller}
        className="mt-2 block w-full rounded-lg border border-accent px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-accent/5"
    >
        {t("detail.messageSeller", "Lähetä viesti")}
    </button>
) : null}
```

### 6b: `useExhaustiveDependencies` in `$conversationId.tsx`

- [ ] **Step 2: Fix the scroll-to-bottom effect dependency**

In `src/routes/viestit/$conversationId.tsx`, the effect at line 37–39 uses `[messages.length]` which Biome flags. Replace with a `useRef`-based approach:

```tsx
// Add this ref near the other refs (after bottomRef):
const prevLengthRef = useRef(messages.length);

// Replace the scroll effect:
useEffect(() => {
    if (messages.length !== prevLengthRef.current) {
        prevLengthRef.current = messages.length;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
}, [messages]);
```

### 6c: Explicit owner guard on rental listing message button

- [ ] **Step 3: Add `!isOwner` to the message button condition**

In `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`, around line 313, the button is guarded by `{!!session}` only. The owner is prevented by an early return, but add an explicit guard for clarity:

```tsx
// Before (line ~313):
{!!session && (
    <button
        type="button"
        onClick={async () => { ... }}
        ...
    >
        {t("detail.messageSeller", "Lähetä viesti")}
    </button>
)}

// After:
{!!session && !isOwner && (
    <button
        type="button"
        onClick={async () => { ... }}
        ...
    >
        {t("detail.messageSeller", "Lähetä viesti")}
    </button>
)}
```

Note: `isOwner` is already defined on line 270 of that component function.

- [ ] **Step 4: Run lint and format**

```bash
pnpm lint:fix && pnpm format:fix
```
Expected: no remaining violations.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/listings/non-rental-sidebar.tsx \
        src/routes/viestit/'$conversationId.tsx' \
        src/routes/pyorat/vuokraus/'$listingId_.$slug.tsx'
git commit -m "fix(messages): biome violations and explicit owner guard on message button"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
pnpm test
```
Expected: all unit tests pass.

- [ ] **Run e2e tests**

```bash
pnpm test:e2e
```
Expected: all e2e tests pass (messaging + lifecycle tests).

- [ ] **Run lint and typecheck one final time**

```bash
pnpm lint:fix && pnpm format:fix && pnpm typecheck
```
Expected: clean.

---

## Notes

**Rate limiting (not a bug):** The reviewer suggested using `rateLimitMiddleware` for consistency. However, `rateLimitMiddleware` is IP-based — appropriate for anonymous actions. Messaging rate limits are user-ID-based (`msg:new:${userId}`, `msg:send:${userId}`), which is intentionally stricter and correct for authenticated endpoints. This is a justified deviation, not a bug.

**Cursor pagination (deferred):** The `beforeCursor` timestamp collision risk in `listMessagesServer` is a known limitation documented in the review. For MVP with low concurrent message volume it's acceptable. A follow-up can add `id` as a tiebreaker.
