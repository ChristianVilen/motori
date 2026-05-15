# Plan: Deepen the booking state machine

Goal: Make `bookings.server.ts` testable without mocking the `booking-emails` and `messages.server` modules. The pure transition logic stays inline; side-effects (emails, conversation creation, system messages) go behind a single injected `BookingNotifier` port.

## Design

**Port:** `BookingNotifier` (defined in `src/lib/booking-notifier.ts`)

```ts
export interface BookingNotifier {
  startConversation(args: { listingId: string; userId: string }):
    Promise<{ conversationId: string }>;

  notifyBookingRequested(args: {
    booking: BookingSummary;
    owner: PartyInfo;
    renter: PartyInfo;
    message: string;
    conversationId: string;
    bookingId: string;
    senderUserId: string;
  }): Promise<void>;

  notifyBookingConfirmed(args: {
    booking: BookingSummary;
    renter: PartyInfo;
    owner: PartyInfo;
  }): Promise<void>;

  notifyBookingRejected(args: {
    booking: BookingSummary;
    renter: PartyInfo;
    reason: string | null;
  }): Promise<void>;

  notifyBookingAutoRejected(args: {
    booking: BookingSummary;
    renter: PartyInfo;
  }): Promise<void>;
}
```

**Two adapters justified:**
1. `realNotifier` — wraps existing `sendBooking*Email`, `startConversationServer`, `sendMessageServer`. Production behavior identical (fire-and-forget email, awaited system message).
2. `createInMemoryNotifier()` — records calls in an array. Test helper.

**Injection:** Each booking function takes an optional `notifier` arg, defaulting to `realNotifier`.

## Steps

1. Create `src/lib/booking-notifier.ts` with the interface, the real adapter, and an in-memory adapter factory.
2. Update `bookings.server.ts` to accept a `notifier` parameter and delegate side-effects through it. Remove direct imports of `booking-emails` and `messages.server`.
3. Update `bookings.server.test.ts` to pass in-memory notifier; remove the `booking-emails` and `messages.server` vi.mock blocks.
4. Update call sites that invoke booking functions (route handlers, cron) — confirm they still work without passing a notifier (the default real one).
5. Verification: pnpm typecheck + pnpm test:unit per task; at the end pnpm lint:fix, pnpm format:fix, pnpm test:e2e.

## Non-goals

- No event bus, no Sans-I/O extraction.
- Cancel email inconsistency (no email currently) is not introduced as a new behavior.
- DB stays mocked the same way in tests (Kysely Proxy queue), per existing pattern.
