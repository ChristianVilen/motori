# Admin Dashboard — Implementation Plan

GitHub Issue: #27
Date: 2026-04-22

## Decisions

- **Auth**: BetterAuth admin plugin (built-in roles, ban/unban, session management)
- **Route**: `/admin` (English, no i18n)
- **Scope v1**: Stats overview + listings table + users table. No reports queue.
- **Bulk actions**: Remove, pause, unpause (existing statuses — no schema change for "feature")
- **Ban**: BetterAuth's built-in `banUser`/`unbanUser` (adds `banned`, `banReason`, `banExpires` to user table)
- **Bootstrap admin**: Seed script for dev, documented SQL one-liner for prod

## Steps

### 1. Install & configure BetterAuth admin plugin

**Files:**
- `src/lib/auth.ts` — add `admin()` plugin import
- `src/lib/auth-client.ts` — add `adminClient()` plugin import

The plugin adds `role`, `banned`, `banReason`, `banExpires` to the `user` table and `impersonatedBy` to the `session` table. Since the project uses `requireEmailVerification`, also add `customSyntheticUser` to include the admin plugin fields.

Run `pnpm db:migrate` (BetterAuth auto-migration) or write a manual Kysely migration if the auto-migrator doesn't work with the existing setup.

### 2. Database migration for admin plugin columns

**File:** `src/lib/db/migrations/008_admin_plugin.ts`

Add columns to match what the admin plugin expects:
- `user.role` — `varchar` default `'user'`
- `user.banned` — `boolean` default `false`
- `user."banReason"` — `text` nullable
- `user."banExpires"` — `timestamp` nullable
- `session."impersonatedBy"` — `varchar` nullable

Then run `pnpm db:codegen` to regenerate `schema.generated.ts`.

**File:** `src/lib/db/schema.ts` — add the new fields to `UserTable` and `SessionTable` interfaces.

### 3. Update seed script to set admin role

**File:** `src/lib/db/seed.ts`

After creating the dev user, set `role = 'admin'` on that user so the admin dashboard is accessible in dev.

Document the prod bootstrap: `UPDATE "user" SET role = 'admin' WHERE email = '<your-email>';`

### 4. Admin auth guard (server function)

**File:** `src/lib/admin.ts`

Create a `requireAdmin` server function that:
1. Gets the session via `auth.api.getSession`
2. Checks `session.user.role === 'admin'`
3. Throws redirect to `/` if not admin

This will be used in `beforeLoad` on all `/admin` routes.

### 5. Admin route layout

**File:** `src/routes/admin/route.tsx`

Layout route for `/admin/*`:
- `beforeLoad` calls `requireAdmin` — server-side redirect for non-admins
- Renders a simple sidebar/tab nav: Stats | Listings | Users
- Minimal layout — no need for the main site nav/footer

### 6. Stats overview page

**File:** `src/routes/admin/index.tsx`

Server function queries:
- Total users: `SELECT count(*) FROM "user"`
- Total listings: `SELECT count(*) FROM listing`
- New signups this week: `SELECT count(*) FROM "user" WHERE "createdAt" >= now() - interval '7 days'`
- Listings by status: `SELECT status, count(*) FROM listing GROUP BY status`

Display as simple stat cards. No charts (out of scope).

### 7. Listings management page

**File:** `src/routes/admin/listings.tsx`

Server functions:
- `getAdminListings` — paginated query with filters (status: all/active/paused/removed), search by title/brand/model
- `adminUpdateListingStatus` — update one or many listings' status (remove/pause/unpause)

UI:
- Table with columns: title, owner, status, city, created, actions
- Status filter dropdown (all / active / paused / removed)
- Search input
- Checkbox selection + bulk action bar (Remove / Pause / Unpause)
- Single-row actions: same status toggles
- Offset-based pagination (simple, admin-only)

### 8. Users management page

**File:** `src/routes/admin/users.tsx`

Server functions:
- `getAdminUsers` — uses `auth.api.listUsers` with search/pagination
- Ban/unban — uses `authClient.admin.banUser` / `authClient.admin.unbanUser` via server functions calling `auth.api.banUser` / `auth.api.unbanUser`

UI:
- Table with columns: name, email, role, banned, created, actions
- Search by name/email
- Ban/unban button per row (with confirmation)
- Offset-based pagination

### 9. Lint, typecheck, verify

- `pnpm lint:fix`
- `pnpm typecheck`
- `pnpm build`
- Manual smoke test of admin routes

## File Summary

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Modify — add admin plugin |
| `src/lib/auth-client.ts` | Modify — add adminClient plugin |
| `src/lib/db/migrations/008_admin_plugin.ts` | Create — migration for admin columns |
| `src/lib/db/schema.ts` | Modify — add role/banned/ban fields to UserTable, impersonatedBy to SessionTable |
| `src/lib/db/seed.ts` | Modify — set dev user role to admin |
| `src/lib/admin.ts` | Create — requireAdmin guard |
| `src/routes/admin/route.tsx` | Create — admin layout with nav |
| `src/routes/admin/index.tsx` | Create — stats overview |
| `src/routes/admin/listings.tsx` | Create — listings management |
| `src/routes/admin/users.tsx` | Create — users management |

## Out of Scope

- Reports/flags queue (no flagging system exists yet)
- Analytics charts
- Email broadcasting
- Payment management
- "Feature" listing action (needs its own issue + homepage UX)
- i18n for admin pages
