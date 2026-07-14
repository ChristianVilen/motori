# Deepening opportunities

Tracking doc for architecture-deepening refactors surfaced on 2026-07-13 (see `docs/adr/0001-listing-module.md` for the vocabulary and the precedent). Work top-down unless something becomes urgent; tick items as they land on `main`.

Vocabulary: a **module** is anything with an interface and an implementation; **deep** = lots of behaviour behind a small interface; a **seam** is where an interface lives; **locality** = change, bugs, and knowledge concentrated in one place.

## Candidates

- [x] **1. Profile module (motori)** — high impact — DONE 2026-07-13
  - Landed as `src/lib/profile.server.ts`: intent-based reads (`getProfileForEdit`, `getPublicProfile`) + two write intents (`completeProfile`, `updateSettings`). Design decisions: two intent methods over upsert+acceptTerms; `completeProfile` stamps a null `terms_accepted_at` retroactively (fixes the settings-first gap); public read composes `getOwnerActiveListings` (new, in `listings-owner.ts`) + `reviews.server`; routes now use `AppError` codes. `Profile` term added to `CONTEXT.md`.

- [x] **2. Session guards for reads (motori)** — DONE 2026-07-13
  - `lib/session.ts` now owns `requireSession()` / `requireUserId()` / `requireSessionOrRedirect(redirectTo?)` (unit-tested). All hand-rolled guards swept: server fns throw `AppError("auth.unauthorized")`, loaders redirect to `/kirjaudu` preserving the return path where it existed. `tori-commands.ts`'s private `getOwnerId` folded into `requireUserId`. Intentionally untouched: `getUnreadTotal`'s anonymous `{unread: 0}` default, `admin.ts`'s `requireAdmin`, and genuinely optional-session reads (search pages, listing detail, `__root`).

- [x] **3. Shared cron runner (`@motori/server/cron`)** — DONE 2026-07-13
  - `runCronTasks(request, tasks, log)` landed in `packages/server/src/cron.ts` (unit-tested: auth, dispatch, task-failure isolation). Both apps' `/api/cron` routes are now one-liners over their `TASKS` maps.

- [ ] **4. GDPR flows as orchestrators + ImageManager (motori)** — medium-high
  - Files: `lib/data-export.ts`, `lib/delete-account.ts`
  - Problem: both query 8+ raw tables directly, bypassing domain modules — a new user-owned table means remembering to update export *and* delete. `deleteByPrefix` here is the app's only storage deletion; removing an image from a listing orphans the object (ADR-0001's deferred ImageManager never landed).
  - Solution: each domain module grows `exportForUser` / `purgeForUser`; GDPR files become thin orchestrators; image cleanup becomes the ImageManager.

- [ ] **5. Reminder repository (talli)** — medium-high
  - Files: `lib/vehicles.ts`, `lib/digest.ts`, `lib/service-records.ts`, `lib/reminders.ts`
  - Problem: the `date`-column `::text` cast quirk is open-coded in ~6 selects, and the "load reminder → check vehicle ownership → mutate" IDOR gate is repeated 4×. Schema changes touch six files.
  - Solution: small reminder repository (ownership-checked loads + shared select fragment applying the casts once), sibling to `getOwnedVehicle`.

- [ ] **6. Extract pure cores from talli server fns** — medium
  - Files: `lib/vehicles.ts` (`getGarage` ranking, `getVehicleDetail` stitching), plus `reminders.ts`, `service-records.ts`, `settings.ts`
  - Problem: non-trivial pure computation lives inside `createServerFn().handler`, so it needs a live DB to exercise — zero tests. `due-state.ts` / `odometer.ts` / `selectDigestReminders` already prove the extraction pattern.
  - Solution: extract ranking + stitching as pure functions; server fns keep fetch + call.

- [ ] **7. Localized-email compose seam** — medium
  - Files: `lib/booking-emails.ts`, `lib/notifications.ts`, `lib/email-templates/new-message.ts` (3 identical `escapeHtml` copies), `lib/auth.ts`; talli's `digest.ts` has the same shape inline
  - Problem: no module owns "send a localized transactional email" — mandatory escaping and idempotency keys are muscle memory across 4 files. A forgotten `escapeHtml` is an HTML-injection bug.
  - Solution: one compose-and-send helper (likely `@motori/server/email`) that injects a pre-bound escaper and wraps automatically; email bodies become pure, testable functions.

- [ ] **8. Small consolidations** — low, do opportunistically alongside the above
  - [ ] Route `reports.ts`, `delete-account.ts`, `data-export.ts` through `protectedMutation` / a `csrfAndRateLimit()` sibling instead of hand-rolled chains
  - [ ] Move `isValidImageUrl` URL-shape knowledge into `@motori/server/image-storage` (currently copied in both apps' `validators.ts`)
  - [ ] Fold talli's `createVehicle` preset mapping into the `reminderTypeColumns` branching (`buildReminderRow`)

## Housekeeping

- [ ] Update ADR-0001: `src/lib/listings.ts` no longer exists (split into six `listings-*` files by axis); describe the real seam
- [x] Create `CONTEXT.md` when the first candidate introduces a new named module — created 2026-07-13 with Listing + Profile

## Explicitly not doing

Already deep, leave alone: `bookings.server.ts` (injected notifier — the house model), `messages.server.ts`, `reviews.server.ts`, the `ImageStorage` seam, `handleImageUpload`, `due-state.ts`, `packages/db`, `packages/ui`, the `AppError` seam, `middleware.ts`. Not re-consolidating the `listings-*` split.
