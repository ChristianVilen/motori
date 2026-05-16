# Deepening Opportunities

## 3. Filter state — split across URL, context, and component state with no single source of truth

**Files:** `src/components/listings/browse-page.tsx` (386 LOC), `filter-sidebar.tsx`, `filter-controls.tsx`, `filter-compositions.tsx`, `filter-drawer.tsx`, `src/lib/validators.ts`

**Problem:** Active filter state lives in URL params; sidebar open/close lives in component state; accumulated pagination pages live in a hook. Understanding "what filters are active for the rental category" requires reading 5 files. Pure filter logic (`countActiveFilters`) is extracted for testability, but the real bugs live in how filter changes trigger navigation — and that code is untested.

**Solution:** A single filter module that owns all filter state and exposes a typed interface: `parseFilters(searchParams)`, `applyFilter(current, change)`, `serializeFilters(state)`. The URL remains the backing store, but the module is the seam — components never touch search params directly.

**Benefits:** _Leverage_ — components call `applyFilter`, they don't construct URL strings. _Locality_ — adding a new filter field is one edit in the filter module. Tests run against the module interface, not against DOM navigation.

---

## 4. Image lifecycle — non-atomic sync between DB and object storage

**Files:** `src/lib/image-storage.ts`, `src/lib/listings-commands.ts`, `src/routes/api/images/upload.ts`

**Problem:** Image upload, DB record creation, and S3 object management are three separate operations with no transaction wrapping them. On listing update, the old S3 objects are never deleted (deferred to a future cleanup job). Understanding "what happens when an image is removed" requires reading three files. The interface to the image system is as complex as its implementation.

**Solution:** An image management module whose interface is `syncImages(listingId, newImages[])` — it diffs the current DB state, deletes orphaned objects, uploads new ones, and updates the DB atomically (or as close as possible given S3's lack of transactions). The `local-substitutable` dependency category applies: tests use a fake S3 stand-in.

**Benefits:** _Locality_ — image sync bugs have one home. _Leverage_ — listing create/update calls one function instead of orchestrating three. Tests assert "after sync, DB and storage agree" without mocking 3 systems.

---

## 5. `requireAdmin` guard — 10-LOC module that's a pass-through

**Files:** `src/lib/admin.ts` (10 LOC), `src/lib/middleware.ts`

**Problem:** The deletion test is instant — delete `admin.ts` and its 10 lines move into `middleware.ts` alongside `requireVerifiedEmail` and `requireAuth`. It currently exists as a separate module but contributes no depth: one function, one call site per route.

**Solution:** Merge `requireAdmin()` into `middleware.ts`. No new abstraction, just fewer files.

**Benefits:** _Locality_ — all route guards in one place. Callers compose `requireAuth + requireAdmin` the same way they compose other middleware.
