# Listings Search Unification & File Split

**Date:** 2026-05-16
**Source:** Deepening opportunity #2 in `deepening_opportunities.md`

## Goal

Eliminate the rental/simple duplication inside `src/lib/listings-queries.ts` (950 LOC) and split the file along its real responsibilities, while moving the module behind TanStack Start's `.server.ts` import-protection boundary.

## Problem

`listings-queries.ts` mixes five concerns: search, detail, edit, owner, stats. Inside the search concern, four pairs of near-duplicate functions handle the rental category separately from the three "simple" categories (sale, gear, part):

- `applyFilters` / `applySimpleFilters`
- `applyCursor` / `applySimpleCursor`
- `applySort` / `applySimpleSort`
- `searchRentalListings` / `searchSimpleCategory`

The pairs differ only in (a) which child table is joined, (b) which column holds the price, and (c) which subset of filters each category supports. The "simple" path uses raw `sql\`child.price\`` because its join graph is widened through `any`; the rental path uses a typed `listing_rental.price_per_day` reference. Adding a filter to a category touches two near-identical functions.

The file additionally relies on a lazy `getDb` dynamic import to keep `pg` out of client bundles, because it is not named `.server.ts`. TanStack Start's import-protection Vite plugin auto-protects `**/*.server.*` files — the recommended pattern.

## Approach

### 1. Unified search pipeline

All four categories join their child table as `... as child` (including rental). A per-category `CategoryConfig` record drives the pipeline:

```ts
interface CategoryConfig {
  childTable: "listing_rental" | "listing_sale" | "listing_gear" | "listing_part";
  priceColumn: RawBuilder<number>; // e.g. sql<number>`child.price_per_day` or sql<number>`child.price`
  supportedFilters: FilterKey[];   // subset of BrowseSearchParams keys this category accepts
}
```

One implementation each replaces the duplicated pairs:

- `applyFilters(query, params, searchMode, config)` walks `config.supportedFilters` and dispatches each to a predicate in a `FILTER_PREDICATES: Record<FilterKey, (q, value) => q>` table. Each predicate is responsible for any join it requires (e.g. the `make` predicate adds the `motorcycle_make` join). No per-category branching inside the function body.
- `applyCursor(query, cursor, sort, config)` and `applySort(query, sort, searchMode, config)` reference `config.priceColumn` instead of hardcoded columns.
- `searchListingsForCategory(params, config)` replaces `searchRentalListings` and `searchSimpleCategory`. The exported `searchListings` server function looks up the config by category and delegates.

Net effect: ~250 LOC of duplicated filter/sort/cursor/search code collapses to ~150 LOC of unified pipeline + ~50 LOC of per-category config tables.

The `biome-ignore noExplicitAny` casts in the simple path may be eliminable once all four categories use the same `child` alias and config-driven column expressions. If they cannot be cleanly removed without over-engineering the Kysely types, the ignores stay.

### 2. File split (TanStack Start `.server.ts` boundary)

Delete `src/lib/listings-queries.ts`. Create four `.server.ts` modules:

| File | Responsibilities |
|---|---|
| `src/lib/listings-search.server.ts` | `searchListings`, `getLatestListings`. Internal: filter pipeline, `CategoryConfig` table, search-mode resolution (`resolveListingSearchMode`), hydration (`hydrateListings`, `attachMakeModel`, `fetchFirstImages`). Exports `SearchResult`, `ListingWithImages` types. |
| `src/lib/listings-detail.server.ts` | `getListingForDisplay`, `getListingForEdit`, `getListingAvailability`, `recordView`. Exports `ListingForDisplay`, `ListingForEdit` types. |
| `src/lib/listings-owner.server.ts` | `getOwnerListings`. Exports `OwnerListingsResult` type. |
| `src/lib/listings-stats.server.ts` | `getHomepageStats`, `getNeighborRegionCount`. Internal: `ADJACENT_REGIONS` table. |

Hydration helpers stay private to `listings-search.server.ts` (the only caller). `recordView` stays in `listings-detail.server.ts` since it is invoked from the detail route.

### 3. Server/client boundary

With `.server.ts` naming:

- The static `import { db } from "~/lib/db/index"` replaces the lazy `getDb()` workaround in all new files.
- Client components and route files continue to import the exported types (`SearchResult`, `ListingForDisplay`, etc.) via `import type` — TypeScript erases these at build, and the import-protection plugin does not block type-only specifiers.
- `pg` and other Node-only dependencies cannot reach client bundles via the new files.

### 4. Importer updates

Update each existing importer of `~/lib/listings-queries` to the appropriate new module path:

- `src/routes/index.tsx` → `listings-search.server`, `listings-stats.server`
- `src/routes/pyorat/vuokraus/index.tsx` → `listings-search.server`
- `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx` → `listings-detail.server`
- `src/routes/pyorat/myynti/index.tsx` → `listings-search.server`
- `src/routes/varaosat/index.tsx` → `listings-search.server`
- `src/routes/varusteet/index.tsx` → `listings-search.server`
- `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` → `listings-detail.server`
- `src/routes/omat/index.tsx` → `listings-owner.server`
- `src/components/listings/empty-state.tsx` → `listings-stats.server`
- `src/components/listings/browse-page.tsx` → `listings-search.server` (type only)
- `src/components/listings/listing-detail-shell.tsx` → `listings-detail.server` (type only)
- `src/lib/listings-detail-route.tsx` → `listings-detail.server`
- `src/lib/listings-detail-route.test.ts` → update `vi.mock("~/lib/listings-queries", ...)` target to `~/lib/listings-detail.server`

## Testing

Per the project's batch-verification preference: skip per-task lint/format/e2e. Each task ends with `pnpm typecheck` + relevant unit tests. The full suite (`pnpm lint:fix`, `pnpm format:fix`, `pnpm typecheck`, unit tests, `pnpm test:e2e`) runs once at the end of the plan.

Manual smoke at the end:

1. Each of the four browse pages renders with default filters.
2. Each browse page paginates correctly (cursor-based "load more").
3. A filter (e.g. `?region=uusimaa`, `?make=yamaha`, `?price_max=200`) narrows results as expected on at least two categories.
4. A free-text search (`?q=ninja`) returns FTS results, then trigram fallback for misspellings.
5. Detail page, edit page, owner dashboard, and homepage all render.

## Risks

- **Rental aliasing.** Renaming the rental join from `listing_rental` to `listing_rental as child` is the one non-trivial change. It normalizes column references but must be verified against the rental availability join used in `getListingAvailability`. Availability lives in `listings-detail.server.ts`, outside the unified search path, so the risk is contained.
- **Type leakage.** Type-only imports from `.server.ts` files into client components rely on TypeScript's type-erasure. The existing `reviews.server.ts` already demonstrates the pattern works in this codebase.
- **Scope creep.** Hydration (`hydrateListings`, `attachMakeModel`, `fetchFirstImages`) is moved into `listings-search.server.ts` as private internals only because `getLatestListings` is the second caller. No new abstraction; just a file move.

## Out of scope

- Refactoring `getListingForDisplay`, `getListingForEdit`, or `getOwnerListings` internals. They move verbatim to their new modules.
- Changing the public API of `searchListings` or any other exported server function. Inputs and outputs stay identical.
- Touching `listings-commands.ts` (287 LOC) — not part of this opportunity.
