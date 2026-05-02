# Listing Module Refactor Plan

## Objective
Extract a deep `ListingModule` to encapsulate all listing-related database operations, providing a clean seam for route handlers and enforcing architectural locality and leverage.

## Context & Decisions
As discussed and documented in `docs/adr/0001-listing-module.md`:
1. **POJOs over Query Builders**: The module will return fully resolved data objects.
2. **Database-Only Writes**: The module will handle `listing_image` DB rows, but not physical file deletion.
3. **Explicit Side Effects**: View counts will be incremented via an explicit `recordView` method.
4. **Intent-Based Reads**: We will implement `getListingForDisplay` (fat) and `getListingForEdit` (lean).
5. **Product Change**: View counts will be removed from the public listing detail page and only shown to the owner on the dashboard.

## Implementation Steps

### 1. Create `src/lib/listings.ts`
Rename `src/lib/listings-queries.ts` to `src/lib/listings.ts` to serve as the home for the `ListingModule`.

### 2. Implement Deep Read Methods
Add the following methods to `src/lib/listings.ts`:
- `getListingForDisplay(shortId: string)`: Fetches listing, images, make/model names, and owner's public profile.
- `getListingForEdit(id: string)`: Fetches listing and images only.
- `recordView(shortId: string, viewerId?: string, ip?: string)`: Explicitly increments the view count with debouncing logic.

### 3. Implement Deep Write Methods
Move the write logic from the route handlers into `src/lib/listings.ts`:
- `createListing(ownerId: string, data: ListingFormData)`: Handles insertion of listing and images.
- `updateListing(id: string, ownerId: string, data: ListingFormData)`: Handles updating the listing and synchronizing image rows within a transaction.
- `setListingStatus(id: string, ownerId: string, status: "active" | "paused" | "removed")`: Handles status updates.

### 4. Refactor Route Handlers
Update the route handlers to use the new `ListingModule` methods instead of raw Kysely queries:
- `src/routes/ilmoitukset/$listingId_.$slug.tsx`: Use `getListingForDisplay` and `recordView`. Remove the view count display from the UI.
- `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`: Use `getListingForEdit` and `updateListing`.
- `src/routes/ilmoitukset/uusi.tsx`: Use `createListing`.
- `src/routes/omat/index.tsx`: Use `getListingForEdit` (or similar lean query for multiple listings) and `setListingStatus`.

### 5. Cleanup and Verification
- Ensure all imports point to `src/lib/listings.ts` instead of `src/lib/listings-queries.ts`.
- Run `pnpm typecheck` and `pnpm lint` to ensure everything is wired correctly.
- Run `pnpm build` to verify the production build succeeds.
