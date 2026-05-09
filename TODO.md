# Marketplace Expansion — GH #101

Multi-category listings: sale/rental/gear/part. Unify tori_items, add business accounts.

## Phase 1: Data Model

- [x] Migration 022 — add category to listing, create listing_rental, migrate data
- [x] Migration 023 — create listing_sale, listing_gear, listing_part tables
- [x] Migration 024 — migrate tori_items into unified listing system
- [x] Migration 025 — add business account fields to profile
- [x] Update schema.ts with new table interfaces
- [x] Fix all type errors (134 errors across 19 files)

## Phase 2: Routes & UI

- [ ] Browse routes — /pyorat/myynti, /pyorat/vuokraus, /varusteet, /varaosat
- [ ] Listing detail pages for each category
- [ ] Create/edit forms with category selection and category-specific fields

## Phase 3: Search & Filters

- [ ] Update search_vector trigger for category-specific text
- [ ] Category-scoped search and filters
- [ ] Business account UI — badge on listings and profile
