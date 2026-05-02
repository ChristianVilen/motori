# 1. Listing Module Encapsulation

Date: 2026-05-01

## Status

Accepted

## Context

The concept of a "Listing" (and its relationships: make, model, images, owner profile) was scattered across multiple route files (`omat/index.tsx`, `uusi.tsx`, `$listingId_.muokkaa.tsx`, `$listingId_.$slug.tsx`) and `listings-queries.ts`. This caused:
- Duplication of complex Kysely joins.
- Duplication of image array synchronization logic during updates.
- Leakage of side effects (e.g., view count increments) into read operations.
- Lack of a clear seam for testing or modifying the core domain logic.

## Decision

We will encapsulate all Listing-related database operations behind a deep `ListingModule` located in `src/lib/listings.ts`.

Key architectural rules for this module:
1. **POJOs over Query Builders**: The module returns fully resolved plain JavaScript objects (e.g., `ListingWithDetails`), not Kysely query builders. Callers do not need to know about the database schema.
2. **Database-Only Writes**: The module is strictly a database layer. It accepts desired image URLs and synchronizes the `listing_image` rows, but does *not* handle physical file deletion (Hetzner Object Storage). Physical file cleanup is deferred to a separate ImageManager or cron job.
3. **Explicit Side Effects**: Read operations are idempotent. Side effects like incrementing view counts are handled by explicit methods (e.g., `recordView`).
4. **Intent-Based Reads**: Read methods are tailored to the caller's intent to avoid over-fetching:
   - `getListingForDisplay`: Returns the full listing, all images, make/model names, and the owner's public profile.
   - `getListingForEdit`: Returns only the listing and its images.

## Consequences

- **Locality**: Adding a new relation (like reviews) or changing the listing schema only touches one file.
- **Leverage**: Route handlers become thin wrappers around `createServerFn` that simply call the deep module methods.
- **View Count Visibility**: As a product decision made during this refactor, view counts are no longer displayed on the public listing detail page. They are only visible to the listing owner on the dashboard.
