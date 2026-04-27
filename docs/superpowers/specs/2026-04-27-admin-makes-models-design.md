# Admin Makes & Models Management

**Date:** 2026-04-27  
**Status:** Approved

## Problem

Users can submit new motorcycle makes and models via the listing form. These go live immediately. Over time this produces typos ("Kawaski") and duplicates ("KTM" / "Ktm"). The admin needs a way to rename entries and merge duplicates without disrupting existing listings.

## Scope

A new admin page at `/admin/makes` with two sections — makes and models — each as a plain table with inline rename, merge, and delete actions. No schema changes. No approval workflow.

## Route & Navigation

- New file: `src/routes/admin/makes.tsx`
- Added to admin nav alongside Listings / Users / Moderation

## UI Layout

### Makes table

Columns: Name | Models | Listings | Actions

- **Rename:** click the name to edit it inline; save on Enter or blur, cancel on Escape
- **Merge:** button opens an inline form on that row — searchable dropdown of other makes, confirm button; on confirm the server reassigns and deletes
- **Delete:** button, disabled (greyed + tooltip) if the make has any listings or models

### Models table

Columns: Name | Make | Listings | Actions

- Make filter dropdown above the table to narrow by make
- Same Rename / Merge / Delete actions as makes
- Delete disabled if model has listings

### Merge UX

No modal. The merge action expands an inline row form:
```
Merge "[Source]" into: [Make/Model picker ▾]  [Confirm]  [Cancel]
```
One confirmation click — no extra dialog. The picker is a plain `<select>` populated from the same data already loaded on the page.

## Server Layer

New file: `src/lib/admin-makes.ts`

All mutations require `requireAdmin()` + `csrfMiddleware()`. No rate limiting needed (admin-only).

| Function | Description |
|---|---|
| `getAdminMakes` | Makes with `listing_count` and `model_count` |
| `getAdminModels(makeId?)` | Models with `listing_count` and `make_name`, optional make filter |
| `renameMake(id, name)` | Update name + regenerate slug |
| `renameModel(id, name)` | Update name |
| `deleteMake(id)` | Blocked server-side if listing_count > 0 or model_count > 0 |
| `deleteModel(id)` | Blocked server-side if listing_count > 0 |
| `mergeMakes(sourceId, targetId)` | Reassign listings, reassign models (change make_id), delete source |
| `mergeModels(sourceId, targetId)` | Reassign listings (change model_id), delete source |

Merge operations run in a transaction.

## Data Flow

Page loads both tables in a single loader via `Promise.all([getAdminMakes(), getAdminModels()])`. After any mutation the route is reloaded via `navigate({ search: prev => ({...prev}) })` — same pattern as the existing admin listings page.

## Error Handling

- Delete blocked → show inline error message on that row
- Rename to empty string → prevented client-side, validated server-side
- Merge source === target → prevented client-side
- All server errors surface as inline row-level error text, not toasts

## What This Does Not Include

- Approval workflow (everything stays live immediately)
- Bulk operations
- Pagination (makes and models lists are small enough to load in full)
- TanStack Table (overkill for two simple lists)
