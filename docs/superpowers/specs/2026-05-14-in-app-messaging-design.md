# In-app messaging — design

**Issue:** [#8 In-app messaging (conversations tied to listings)](https://github.com/ChristianVilen/motori/issues/8)
**Date:** 2026-05-14
**Status:** Approved, ready for implementation plan

## Goal

Let buyers contact sellers about a specific listing without exposing contact details, and replace the one-shot `booking.message` inquiry with a persistent conversation that continues after a booking request is placed.

## Decisions (Q&A)

1. **Relationship to bookings:** booking flow uses a conversation; the initial inquiry becomes the first message in the thread.
2. **Uniqueness:** one conversation per `(listing_id, buyer_id)` — clicking "Lähetä viesti" reopens the existing thread. Bookings reference whichever conversation they originated from.
3. **Delivery:** Server-Sent Events for live updates while a thread is open.
4. **Email notifications:** one email per conversation for the *first* unread message; re-armed once the recipient reads.
5. **Content:** plain text only in MVP. Newlines preserved, URLs linkified on render. No attachments.
6. **Read state:** track per-participant `last_read_at`; drive unread badges. No "seen" indicator to the sender.
7. **Safety:** report + per-user block + rate limiting (new conversations and messages).

## Approach

Conversation-first architecture. Conversations are the primary entity; the rental booking flow opens or reuses a conversation and posts a structured **system message** (`kind = 'booking_request'`) into it. A single inbox at `/viestit` serves both general inquiries and booking conversations.

## Data model

Three new tables, plus one nullable column added to `booking`.

```ts
export interface ConversationTable {
  id: Generated<string>;
  listing_id: string;
  buyer_id: string;        // initiator (never the listing owner)
  seller_id: string;       // denormalised from listing.owner_id for cheap auth checks
  last_message_at: ColumnType<Date, Date | undefined, Date>;
  buyer_last_read_at:  ColumnType<Date, Date | undefined, Date> | null;
  seller_last_read_at: ColumnType<Date, Date | undefined, Date> | null;
  created_at: ColumnType<Date, Date | undefined, Date>;
  // UNIQUE (listing_id, buyer_id)
}

export type MessageKind = "text" | "booking_request";

export interface MessageTable {
  id: Generated<string>;
  conversation_id: string;
  sender_id: string;            // for booking_request: same as conversation.buyer_id
  kind: Generated<MessageKind>; // default 'text'
  body: string;                 // for booking_request: the buyer's inquiry text
  booking_id: string | null;    // populated when kind = 'booking_request'
  created_at: ColumnType<Date, Date | undefined, Date>;
}

export interface UserBlockTable {
  blocker_id: string;
  blocked_id: string;
  created_at: ColumnType<Date, Date | undefined, Date>;
  // PK (blocker_id, blocked_id)
}
```

**`BookingTable` change:** add `conversation_id: string | null`. The existing `message` column stays — nullable on new rows, populated on historical rows. No backfill.

### Indexes

- `conversation(buyer_id, last_message_at DESC)` — buyer inbox
- `conversation(seller_id, last_message_at DESC)` — seller inbox
- `message(conversation_id, created_at)` — thread paging + unread counting
- `user_block(blocked_id, blocker_id)` — cheap "can X message Y?" lookup
- `UNIQUE (listing_id, buyer_id)` on `conversation` enforces the one-per-pair rule

### `report` table

Extend `target_type` to accept `"conversation"` and `"message"` in addition to existing values. No schema change — column is already `string`.

## Routes

All under the auth-required layout. Finnish slugs, consistent with existing routes.

- `GET /viestit` — inbox, sorted by `last_message_at DESC`. Each row: other party's name, listing thumb + title, last-message preview, unread badge.
- `GET /viestit/$conversationId` — thread view. Listing summary card on top, paged message list, composer at bottom. Marks the conversation read on mount.

### Triggers from existing pages

- Listing detail (`listings-detail-route.tsx`): "Lähetä viesti" button. Hidden if the viewer is the owner; replaced by a sign-in link for anonymous viewers.
- Rental booking submit: server creates (or reuses) the conversation, creates the booking with `conversation_id`, inserts a `booking_request` system message. The booking confirmation page links to the thread.

## Server functions

New `src/lib/messages.ts` (client-callable, types) and `messages.server.ts` (handlers), mirroring the existing `bookings` split.

| Name | Purpose | Auth |
|---|---|---|
| `startConversation({ listingId })` | Find-or-create. Rejects: owner-as-buyer, listing status = removed, viewer banned, seller has blocked viewer. Rate-limit: 10 new / user / hour. | session |
| `listConversations()` | Inbox rows for current user (as buyer or seller). | session |
| `getConversation({ id })` | Conversation + listing summary + other-party profile snippet. 403 if non-participant. | participant |
| `listMessages({ conversationId, beforeCursor? })` | Paged, 50/page, descending then reversed on the client. | participant |
| `sendMessage({ conversationId, body })` | Insert text message. Rejects: blocked either direction, listing removed, empty/over 4000 chars. Updates `last_message_at`. Triggers email predicate. Rate-limit: 30 / user / minute. | participant |
| `markRead({ conversationId })` | Sets `{buyer,seller}_last_read_at = now()`. | participant |
| `streamConversation({ conversationId })` | SSE endpoint. Streams new messages for this thread. | participant |
| `blockUser({ userId })` / `unblockUser({ userId })` | Manage `user_block`. | session |

Rate limits reuse `src/lib/rate-limit.ts`.

## SSE delivery

- One SSE connection **per open thread** (not a global firehose).
- In-memory pub/sub: new `src/lib/messages-bus.ts` wrapping a `Map<conversationId, Set<subscriber>>` with `publish` / `subscribe`. `sendMessage` calls `publish` after the DB insert commits.
- Event payload: the full new `Message` row.
- Client behaviour: append on receipt; scroll-pin to bottom if near bottom, otherwise show a "uusia viestejä" pill.
- Heartbeat every 25 s; client reconnects with exponential backoff on close.
- Per-user cap: max 5 concurrent SSE streams (close oldest on excess).
- **Single-process assumption:** the in-memory bus is correct only because the app runs as a single Node process (Hetzner VM, Procfile-driven). Horizontal scaling will require swapping for Postgres `LISTEN/NOTIFY`. Out of MVP scope.

## Email notifications

Triggered inside `sendMessage`, after the insert:

1. Recipient = the participant that is not `sender_id`.
2. `recipientLastRead = recipient === buyer ? buyer_last_read_at : seller_last_read_at`.
3. Look up the most recent prior message in this conversation (excluding the one just inserted).
4. **Send iff** `recipientLastRead >= prior.created_at`, OR there is no prior message. This means the recipient was caught up and this is the first unread — exactly Q4-B.
5. Skip if `recipient.emailVerified === false` (consistent with `require-verified-email.ts`).

Implementation: reuses `src/lib/email.ts`. New template `src/lib/email-templates/new-message.tsx` (or `.ts`, matching the existing convention). Subject: `Uusi viesti ilmoituksesta "<title>"`. CTA → `/viestit/$conversationId`.

## Unread counts

- Per-conversation unread = count of messages where `created_at > <user>_last_read_at` AND `sender_id != currentUser.id`. Computed in `listConversations` via correlated subquery; cheap with the existing `(conversation_id, created_at)` index.
- Global nav badge = sum of per-conversation unreads. Fetched once on layout mount, then incremented client-side on SSE events for conversations the user is not currently viewing. Reset by `markRead`.
- No cache table at MVP volume; revisit if profiling shows it.

## i18n

New `messages` namespace under `src/lib/i18n/`, fi + en, following the existing `bookings` / `listings` pattern.

## Safety controls

- **Reporting:** existing `report` flow with `target_type` widened. No new admin UI in MVP — reports surface in the existing admin reports view.
- **Block:** `user_block` table. Blocked-by relationship checked in `startConversation` and `sendMessage`. Existing threads become read-only for the *blocked* party; the blocker may still post if they want to.
- **Rate limits:** 10 new conversations / user / hour, 30 messages / user / minute. Both via `rate-limit.ts`.

## Testing

**Unit** (`src/lib/messages.test.ts`, `messages.server.test.ts`):

- `startConversation`: idempotency; rejects owner-as-buyer; rejects when blocked; rejects when listing removed; rate-limit at 11th call/hour.
- `sendMessage`: rejects blocked direction; rejects empty / >4000 chars; updates `last_message_at`; correct unread state; publishes exactly once.
- Email-trigger predicate: table-driven (no prior, prior read, prior unread).
- `markRead`: updates only the correct participant column; idempotent.
- Block: blocked party cannot start or send; existing threads readable; blocker still allowed to post.

**E2E** (`e2e/messaging.spec.ts`):

- Buyer messages seller from listing page → both inboxes update → reply round-trip via SSE.
- Rental booking inserts a `booking_request` system message rendered distinctly.
- Unread badge increments and clears across navigations.
- Removed listing: existing thread read-only; "Lähetä viesti" hidden on the listing page.

## Migration & rollout

- Single Kysely migration adding the three tables, `booking.conversation_id` (nullable), the unique constraint, and indexes.
- No backfill. `/omat/varaukset/$id` renders the legacy `booking.message` inline when `conversation_id IS NULL`, otherwise links to the thread.
- No feature flag — ships behind the normal release. Login gate is the only access control.

## Out of scope

- Attachments / images
- Sender-visible read receipts
- Group conversations
- Search inside messages
- Browser / mobile push notifications
- Horizontal-scale message bus (Postgres `LISTEN/NOTIFY`) — documented above
- Admin moderation UI dedicated to conversations
