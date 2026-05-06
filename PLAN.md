# Implementation Plan — Bidirectional Reviews

## Problem Statement

After a confirmed booking's rental period ends, renters and owners have no way to rate each other. We need a mutual review system that builds trust on the platform while preventing retaliation bias through simultaneous reveal.

## Requirements

- Reviews become eligible automatically when a confirmed booking's `end_date` passes
- Bidirectional: both renter and owner can review each other per booking
- 1–5 star rating + optional text comment (max 1000 chars)
- 14-day review window after end_date
- Reviews hidden until both are submitted OR the 14-day deadline passes (simultaneous reveal)
- Reviews displayed on both the public profile page and listing detail page (owner's aggregate rating)

## Data Model

```sql
CREATE TABLE review (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
    reviewer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    target_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT review_booking_reviewer_unique UNIQUE (booking_id, reviewer_id),
    CONSTRAINT review_rating_check CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT review_no_self_review CHECK (reviewer_id != target_user_id)
);

CREATE INDEX review_target_user_id_idx ON review(target_user_id);
CREATE INDEX review_booking_id_idx ON review(booking_id);
```

## Reveal Logic

A review is "revealed" (publicly visible) when:
1. Both reviews for the booking exist, OR
2. `booking.end_date + 14 days < now()`

This is evaluated at query time — no cron job needed.

## Task Breakdown

### Task 1: Database migration for the `review` table

**Objective:** Create the `review` table with proper constraints and indexes.

**Implementation:**
- Create migration `019_reviews.ts`
- Add `ReviewTable` interface and `review` entry to `Database` interface in `schema.ts`
- Run `db:migrate`

**Tests:** Migration up/down executes cleanly.

---

### Task 2: Review types, validators, and pure helpers

**Objective:** Define TypeScript types, Zod validation, and pure eligibility functions.

**Implementation:**
- Add `ReviewTable` interface to `schema.ts` with Kysely column types
- Add `Review`, `NewReview` type aliases
- Add `submitReviewSchema` to `validators.ts`: `{ booking_id: uuid, rating: int 1–5, comment: string max 1000 optional }`
- Create `src/lib/reviews.ts` with pure helpers:
  - `isReviewEligible(status, endDate)` — confirmed + end_date < today
  - `isReviewWindowOpen(endDate)` — within 14 days of end_date
  - `isReviewRevealed(bothSubmitted, endDate)` — both exist or deadline passed

**Tests:** Unit tests for all three helpers with boundary dates and edge cases.

---

### Task 3: Server-side review logic (submit + query)

**Objective:** Implement server functions for submitting and fetching reviews.

**Implementation:**
- Create `src/lib/reviews.server.ts`:
  - `submitReview({ bookingId, userId, rating, comment })` — validates authorization, eligibility, window, no duplicate
  - `getReviewsForUser(targetUserId)` — returns revealed reviews with reviewer display_name
  - `getReviewSummaryForUser(targetUserId)` — returns `{ averageRating, reviewCount }`
  - `getReviewStatusForBooking(bookingId, userId)` — returns `{ userHasReviewed, counterpartyHasReviewed, windowOpen }`

**Tests:** Integration tests for submit (auth, duplicate prevention, window expiry) and reveal logic in queries.

---

### Task 4: Review submission UI on booking detail page

**Objective:** Add review form to `/omat/varaukset/$bookingId` when eligible.

**Implementation:**
- Extend `getBooking` loader to include review status for the booking
- Create `ReviewForm` component: clickable 1–5 star rating + optional textarea + submit button
- Show form when: confirmed, end_date passed, window open, user hasn't submitted
- Show "submitted, waiting for reveal" message if already reviewed
- Show revealed reviews once both visible
- Server function `submitReviewFn` with `protectedMutation` middleware
- i18n keys in `fi/profile.ts` and `en/profile.ts`

**Tests:** E2E test submitting a review after a completed booking.

---

### Task 5: Reviews on public profile page

**Objective:** Display aggregate rating and individual reviews on `/profiili/$userId`.

**Implementation:**
- Extend `getPublicProfile` to fetch review summary + revealed reviews
- Display aggregate rating in profile header: "4.3 ★ (7 arvostelua)"
- List individual reviews: reviewer name, stars, comment, date
- Empty state: "Ei vielä arvosteluja"
- i18n keys for review display

**Tests:** Verify reviews appear only when revealed.

---

### Task 6: Owner rating on listing detail page

**Objective:** Show owner's aggregate rating on listing detail.

**Implementation:**
- Extend `getListing` to fetch `getReviewSummaryForUser(owner_id)`
- Display "★ 4.5 (12)" next to owner name, linked to profile
- Hide if no reviews (don't show "0 reviews")

**Tests:** Rating appears when owner has reviews, hidden otherwise.

---

### Task 7: Edge cases and hardening

**Objective:** Handle edge cases around review eligibility.

**Implementation:**
- Block reviews for bookings that aren't in "confirmed" status
- `CHECK (reviewer_id != target_user_id)` prevents self-review at DB level
- Verify reveal timing: single-party review becomes visible after 14 days
- Ensure expired/rejected/cancelled bookings cannot be reviewed

**Tests:** Unit tests for edge cases — cancelled bookings, self-review attempt, reveal timing boundaries.
