# Listing slug URLs

**Date:** 2026-04-28  
**Status:** Approved

## Goal

Replace UUID-only listing URLs (`/ilmoitukset/<uuid>`) with short ID + decorative slug URLs (`/ilmoitukset/<shortId>/<make-model-city>`). No backward compatibility required — fresh project.

## Data layer

### `short_id` column

- New column `short_id varchar(8) not null unique` added to the `listing` table via migration.
- Generated at insert using `generateShortId()`: `crypto.randomBytes` → Base62 alphabet (`a-zA-Z0-9`), 8 characters.
- 62^8 ≈ 218 trillion combinations. Collision probability at 1 million listings is ~1 in 218 billion per insert — no retry logic, DB unique constraint is the safety net.
- `schema.ts` updated to add `short_id: string` to `ListingTable`.

### Slug utility

- New `slugify(text: string): string` helper (e.g. in `src/lib/utils.ts`):
  - Transliterate Finnish chars: `ä→a`, `ö→o`, `å→a`
  - Lowercase
  - Replace non-alphanumeric with hyphens
  - Collapse and trim hyphens
- `MotorcycleMakeTable` already has a `slug` field — used directly.
- Model name and city are slugified at call sites.
- Slug composed as: `${make.slug}-${slugify(model.name)}-${slugify(city)}`
  - If model is null: `${make.slug}-${slugify(city)}`

Slug is **not stored** — derived at query/render time from already-joined make/model/city data.

## Routing

### Detail page

- File renamed: `src/routes/ilmoitukset/$listingId.tsx` → `src/routes/ilmoitukset/$listingId_.$slug.tsx`
- TanStack Router flat-file sibling pattern (trailing `_` opts out of parent layout).
- Matches `/ilmoitukset/:listingId/:slug`.
- Only `params.listingId` (the `short_id`) is used for the DB lookup — `params.slug` is ignored.

### Edit page

- `$listingId_.muokkaa.tsx` unchanged — edit URL remains `/ilmoitukset/:shortId/muokkaa` (no slug needed).

## Call sites to update

All places that build listing URLs must switch from `listing.id` (UUID) to `listing.short_id` + computed slug:

| File | Change |
|------|--------|
| `src/components/listings/listing-card.tsx` | `listingId: listing.short_id`, add `slug` param |
| `src/routes/ilmoitukset/uusi.tsx` | `navigate` after create: use `short_id` + slug |
| `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` | `navigate` + `Link` after save: use `short_id` |
| `src/routes/admin/moderation.tsx` | Two template literal hrefs → use `short_id` + slug |
| `src/routes/sitemap[.]xml.ts` | Listing URLs → use `short_id` + slug |
| `src/routes/ilmoitukset/$listingId_.$slug.tsx` | `og:url` and canonical → use `short_id` + slug |

Queries that feed listing cards and the detail page must select `short_id`, `make.slug`, `model.name` (already joined in most cases for display).

## DB migration

Single migration file `015_listing_short_id.ts`:
1. Add `short_id varchar(8)` nullable.
2. Backfill existing rows with generated short IDs (for dev seed data).
3. Add `not null` constraint.
4. Add unique index.

## Out of scope

- Redirecting old UUID URLs (no backward compat needed).
- Adding `slug` to `MotorcycleModelTable` (name is slugified at runtime).
- Changing the edit page URL to include a slug segment.
