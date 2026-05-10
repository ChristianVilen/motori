# Deepening Opportunities

Architectural friction surfaced after the marketplace-phase2 PR. Vocabulary per the `improve-codebase-architecture` skill (module / interface / implementation / seam / depth / leverage / locality). Domain terms straight from the codebase: *Listing*, with four *categories* — rental, sale, gear, part.

Generated: 2026-05-10. ADR context: `docs/adr/0001-listing-module.md`.

---

## 1. Per-category form section adapters behind one `ListingForm` interface

- **Files**: `src/components/listings/listing-form.tsx` (1184 lines)
- **Problem**: The `ListingForm` interface is small (one prop bag), but the implementation flattens four categories into one Cartesian-product state object — fields prefixed `sale_*`, `gear_*`, `part_*` plus a parallel set of conditional-initial-values. The submit handler then rebuilds the discriminated payload via four `if (category === …)` branches (lines 175-245), each repeating the shared fields. The discriminated union from `validators.ts` is *strong*, but here it's been widened with `Partial<RentalFormData> & Partial<SaleFormData> & Partial<GearFormData> & Partial<PartFormData>` — an admission that the implementation has no internal seam matching the domain. Cognitive complexity is silenced with a Biome ignore comment.
- **Solution**: Introduce a `CategoryFormSection` interface — one adapter per category (`RentalSection`, `SaleSection`, `GearSection`, `PartSection`). Each adapter owns its sub-form state, its render, and a `toPayload(shared)` that returns its discriminated branch. `ListingForm` becomes the shared shell: image upload, location, description, the category tile selector, then delegates to `sections[category]`.
- **Depth**: today's interface is deep (one prop bag → entire form), but its implementation has *four shallow categories pretending to be one*. Splitting reveals the real **seam** — *category* — and gives each adapter the *small* interface it deserves.
- **Leverage**: a fifth category (e.g. accessories) becomes a new adapter, not a fifth `if` branch in five places. **Locality**: a sale-condition bug lives entirely in `SaleSection`; today it threads through defaultValues, render, payload assembly, and Zod parse together.
- **Tests**: each adapter is independently testable through its `(initialValues) → toPayload → discriminated branch` shape — the section's interface is the test surface. Currently the only test surface is the whole 1184-line form.

## 2. Category-detail route factory

- **Files**: `src/routes/pyorat/myynti/$listingId_.$slug.tsx`, `pyorat/vuokraus/…`, `varusteet/…`, `varaosat/…` (~380 lines, ~75% duplicated)
- **Problem**: Four routes repeat: identical `getListing` server fn (differs only in `result.listing.category !== <X>` check and inline owner-phone query), identical loader shape, identical `notFoundComponent`, identical `Route.useLoaderData()` destructure passed to `ListingDetailShell`. The category-specific surface is tiny: which sidebar adapter, which `backTo` path, the head meta strings, and the price-extracting accessor. Today that tiny surface is buried under copies of the bulk.
- **Solution**: A `defineCategoryDetailRoute({ category, backTo, sidebar, head, priceFor })` factory in `src/lib/listings-detail-route.tsx` that returns the route config. Each category file becomes ~15 lines of wiring.
- **Depth**: callers learn one interface (the factory's options) instead of memorizing the loader/server-fn ritual. **Locality**: when we add OG-image generation or migrate `getReviewSummaryForUser` calls, we change one place. **Deletion test**: deleting the factory would force the loader+server-fn ritual back into all four files — complexity reappears, so the factory earns its keep.
- **Tests**: the factory's interface is the test surface — one adapter test asserts the loader-not-found path, one for category mismatch, one for the success path. Today these would need 4× duplication.

## 3. Non-rental sidebar — slot-based deepening ✅ DONE

- **Files**: `src/components/listings/non-rental-sidebar.tsx` (replaces `sale-detail-sidebar.tsx`, `gear-detail-sidebar.tsx`, `part-detail-sidebar.tsx` — ~240 deduplicated lines → one 84-line component)
- **Problem**: Three sidebars shared a frame (price card → stat row → owner-action-or-contact CTA) but differed only in *which stats* they show. The owner-vs-anonymous CTA — a non-trivial state machine across `isOwner`, `listing.status`, `ownerPhoneVisible`, `ownerPhone` — was copied verbatim three times.
- **Solution**: A single `NonRentalSidebar` taking `{ price, priceTestId, negotiable?, statRows, listing, isOwner, ownerPhoneVisible, ownerPhone, ownerUserId }`. Each route file builds its own `statRows` array with category-specific label maps.
- **Depth & locality**: the contact-CTA state machine lives once. A future change ("show negotiable badge", "add SMS link") touches one place.
- **Tests**: the contact-CTA state machine can now be independently tested behind a small interface — previously tested only via three duplicate UI tests.

## 4. Per-category search adapters in `listings-queries.ts`

- **Files**: `src/lib/listings-queries.ts:343-449` (`searchSimpleListings`)
- **Problem**: The function fans across three categories using a dynamically-named child table (`listing_sale | listing_gear | listing_part`). Kysely's typing fights this so the implementation uses `as any` 6 times. The price-min/max + condition filters reach into `child.price` / `child.condition` via `` sql`…` as any ``. There's already a sibling `searchRentalListings` with full static types (the rental child has different price columns, so it forked). The interface (one server fn) looks deep, but the implementation's seam is "any-cast away the category dimension."
- **Solution**: Promote the existing rental-fork pattern to all four. Four small `searchSale | searchGear | searchPart | searchRental` functions, each fully typed. The exported `searchListings` server fn becomes a 4-line dispatch.
- **Depth**: at the *interface* the public seam is unchanged (one function). At the *implementation* the `any`-cast disappears and Kysely actively prevents bad column references on child filters. **Leverage** comes back to the type system; **locality** improves because adding a sale-only filter (e.g. `mileage_max`) doesn't risk leaking into the gear path.
- _Note_: ADR-0001 explicitly says "POJOs over Query Builders" and the module is the seam — this candidate works inside that ADR, not against it.

## 5. Category → URL adapter

- **Files**: `src/components/listings/listing-card.tsx`, `src/routes/index.tsx`, `src/routes/sitemap[.]xml.ts`, `src/routes/ilmoitukset/uusi.tsx`, `src/routes/tori/$itemId_.$slug.tsx`
- **Problem**: The mapping `category → URL prefix` ("sale" → `/pyorat/myynti`, "gear" → `/varusteet`, …) is duplicated in five places. Three of them additionally know the trailing slug shape (`/${prefix}/${shortId}/${slug}`). Today: one duplicated literal map. Two adapters means a real seam — we have five.
- **Solution**: A small module `src/lib/category-routes.ts` exporting `categoryBrowsePath(category)` and `categoryDetailPath({ category, shortId, slug })`. Tiny — but the seam is real.
- **Locality**: when we rename `/pyorat/myynti` → `/myynti` (already a tempting shortening), one change instead of five.
- **Deletion test**: deleting concentrates a literal-string mapping in five files — so the module pays back at the very next URL change.

## 6. Owner-phone-visibility lookup as a Listing-module read

- **Files**: `src/routes/pyorat/myynti/$listingId_.$slug.tsx:25-35`, `pyorat/vuokraus/…`, `varusteet/…`, `varaosat/…`
- **Problem**: Each detail route reaches into `db.selectFrom("profile").select(["phone","show_phone"])` inline. That's a leak across the Listing-module seam established by ADR-0001 — "Route handlers become thin wrappers around `createServerFn` that simply call the deep module methods." Four near-identical leaks.
- **Solution**: Extend `getListingForDisplay` (or add `getOwnerContact`) to include the contact tuple. Adapter #2 above absorbs this naturally.
- **Status**: this is *consistent* with ADR-0001, not contradicting it — the ADR's intent is to keep route files thin, and this leak post-dates it.

---

## Suggested ordering

1. **#1 + #2** — biggest locality loss in this PR; tackle together since #2 absorbs #6 naturally.
2. **#5** — small and obvious; fold into either #1 or #2.
3. **#4** — most defensible cleanup against the type system; independent.
4. **#3** — useful but smaller; can wait.
5. **#6** — absorbed by #2.
