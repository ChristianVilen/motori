# Deepening Opportunities

## 1. Booking state machine — email dispatch inside transition logic

**Files:** `src/lib/bookings.server.ts` (476 LOC), `src/lib/booking-emails.ts`, `src/lib/messages.server.ts`

**Problem:** Each state transition (`createBookingRequest`, `confirmBooking`, `rejectBooking`) embeds email dispatch and conversation side-effects inline. The interface to test booking logic is inseparable from the interface to the email system. The test file mocks 4 email functions just to test a date overlap check. The interface is nearly as complex as the implementation — callers must understand both the booking lifecycle *and* all its side effects.

**Solution:** Define a seam between the booking state machine and its side-effects. The pure transition logic (availability check, overlap detection, cost calculation) sits inside the module; email and messaging are injected adapters. Two adapters are justified: a real one (email + DB) and an in-process one (in-memory, no email) for tests.

**Benefits:** *Locality* — booking rules live in one place, email rules in another, bugs can't hide across the join. *Leverage* — the booking module's interface shrinks to "attempt transition, get result"; callers don't reason about email. Tests assert on booking state through the interface without mocking email.

---

## 2. Listing hydration — shallow multi-step assembly hidden in a 950-LOC file

**Files:** `src/lib/listings-queries.ts` (950 LOC), `src/lib/listings-commands.ts` (287 LOC)

**Problem:** Callers must assemble a listing from `hydrateListings()` → `attachMakeModel()` → `fetchFirstImages()` — three functions across the same file, called in sequence. Understanding what "a fully-hydrated listing" is requires reading all three. The 4-category branching (`rental`, `sale`, `gear`, `part`) means `applyFilters()` and `applySimpleFilters()` are near-identical with minor divergence — the interface grows with every new category.

**Solution:** A single `searchListings(params)` module that returns fully-hydrated listings. The assembly pipeline becomes an implementation detail behind the interface. Category-specific SQL fragments are internal seams, not part of the external interface.

**Benefits:** *Leverage* — one function, one return type, no assembly steps for callers. *Locality* — adding a new filterable field is one edit, not three. Tests target the interface (given filters → expected results) using a real PGLite stand-in, replacing the current per-function unit tests.

---

## 3. Filter state — split across URL, context, and component state with no single source of truth

**Files:** `src/components/listings/browse-page.tsx` (386 LOC), `filter-sidebar.tsx`, `filter-controls.tsx`, `filter-compositions.tsx`, `filter-drawer.tsx`, `src/lib/validators.ts`

**Problem:** Active filter state lives in URL params; sidebar open/close lives in component state; accumulated pagination pages live in a hook. Understanding "what filters are active for the rental category" requires reading 5 files. Pure filter logic (`countActiveFilters`) is extracted for testability, but the real bugs live in how filter changes trigger navigation — and that code is untested.

**Solution:** A single filter module that owns all filter state and exposes a typed interface: `parseFilters(searchParams)`, `applyFilter(current, change)`, `serializeFilters(state)`. The URL remains the backing store, but the module is the seam — components never touch search params directly.

**Benefits:** *Leverage* — components call `applyFilter`, they don't construct URL strings. *Locality* — adding a new filter field is one edit in the filter module. Tests run against the module interface, not against DOM navigation.

---

## 4. Image lifecycle — non-atomic sync between DB and object storage

**Files:** `src/lib/image-storage.ts`, `src/lib/listings-commands.ts`, `src/routes/api/images/upload.ts`

**Problem:** Image upload, DB record creation, and S3 object management are three separate operations with no transaction wrapping them. On listing update, the old S3 objects are never deleted (deferred to a future cleanup job). Understanding "what happens when an image is removed" requires reading three files. The interface to the image system is as complex as its implementation.

**Solution:** An image management module whose interface is `syncImages(listingId, newImages[])` — it diffs the current DB state, deletes orphaned objects, uploads new ones, and updates the DB atomically (or as close as possible given S3's lack of transactions). The `local-substitutable` dependency category applies: tests use a fake S3 stand-in.

**Benefits:** *Locality* — image sync bugs have one home. *Leverage* — listing create/update calls one function instead of orchestrating three. Tests assert "after sync, DB and storage agree" without mocking 3 systems.

---

## 5. `requireAdmin` guard — 10-LOC module that's a pass-through

**Files:** `src/lib/admin.ts` (10 LOC), `src/lib/middleware.ts`

**Problem:** The deletion test is instant — delete `admin.ts` and its 10 lines move into `middleware.ts` alongside `requireVerifiedEmail` and `requireAuth`. It currently exists as a separate module but contributes no depth: one function, one call site per route.

**Solution:** Merge `requireAdmin()` into `middleware.ts`. No new abstraction, just fewer files.

**Benefits:** *Locality* — all route guards in one place. Callers compose `requireAuth + requireAdmin` the same way they compose other middleware.
