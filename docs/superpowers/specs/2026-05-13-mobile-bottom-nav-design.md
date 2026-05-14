# Mobile Bottom Nav — Design

Date: 2026-05-13
Status: Approved (design)

## Purpose

Give mobile users a persistent, thumb-reachable navigation surface. The current top nav is functional on desktop but cramped on phones and forces users to scroll up to switch sections or initiate an action. A bottom nav improves discoverability of core flows (browse, search, list, bookings, account) and matches user expectations from native apps.

## Scope

In scope:

- A new mobile-only bottom navigation bar with 5 tabs.
- A full-screen search overlay opened from the Search tab.
- Slimming the existing top nav under the `md` breakpoint.
- Auth gating that mirrors current top-nav behavior (login modal for protected actions).

Out of scope (deferred):

- Hide-on-scroll behavior.
- Badge counts (e.g. unread bookings).
- Haptic feedback or non-trivial animations.
- Keyboard-aware hiding when the iOS keyboard is open.
- Backend search work — `q` already exists on `browseSearchSchema` and the FTS pipeline (`search_vector`, prefix + trigram fallback in `src/lib/listings-queries.ts`) is in place.

## Architecture

Two new components, plus a small edit to `src/routes/__root.tsx`.

- `src/components/nav/bottom-nav.tsx` — the bar itself. Rendered once in `__root.tsx`, hidden at `md+` via `md:hidden`. Fixed to viewport bottom with iOS safe-area padding.
- `src/components/nav/mobile-search-overlay.tsx` — a full-screen sheet opened from the Search tab. Owns the search input, category shortcuts, city picker, and recent-searches list.
- `src/routes/__root.tsx` — adds slim mobile variant for the existing top nav (logo + language selector only at `< md`), renders `<BottomNav>` after `<main>`, and manages overlay open/close state alongside the existing `loginOpen` state.

Routing and active state are driven by `useRouterState({ select: s => s.location.pathname })`. No new server functions, no schema changes.

## Tabs

| Tab | Icon | Action (signed in) | Action (signed out) |
|---|---|---|---|
| Browse | home | `Link` to `/` | Same |
| Search | magnifier | Opens `MobileSearchOverlay` | Same (search is public) |
| Add | plus (filled accent circle) | `Link` to `/ilmoitukset/uusi` if verified; tooltip + no-op if unverified | Opens login modal |
| Bookings | calendar | `Link` to `/omat` | Opens login modal |
| Account | user | `Link` to `/asetukset` | Opens login modal |

Active state rules:

- A tab is active when the current pathname matches or starts with its route. Browse uses an exact `/` match (otherwise it would highlight on every route).
- Search and Add never show active styling — they are actions, not destinations.

The Add tab is visually elevated to read as the primary CTA: its icon sits inside a filled `bg-accent` circle, while the other tabs use plain icons.

## Search overlay

Opened from the Search tab. Full-screen modal (`position: fixed; inset: 0; z-50`) with a close button (top-right).

Contents in order:

1. **Text input** — autofocus on open. Submitting (`Enter` or tap of search button) navigates to `/pyorat/myynti?q=<value>` and closes the overlay. Persists the query into recent-searches before navigating.
2. **Category shortcuts** — 4 tappable cards in a 2×2 grid: Myynti (`/pyorat/myynti`), Vuokraus (`/pyorat/vuokraus`), Varusteet (`/varusteet`), Varaosat (`/varaosat`). Tap → navigate and close.
3. **City quick picker** — reuses the existing `CitySelect` component (`src/components/listings/city-select.tsx`). Selecting a city navigates to `/pyorat/myynti?city=<city>` and closes.
4. **Recent searches** — up to 5 most recent queries, newest first. Stored in `localStorage` under `motori:recentSearches` as a JSON array of strings. Tap a row to re-run that query (same nav as text submit). Section is hidden when the list is empty.

Behavior:

- Focus is trapped inside the overlay; Escape closes it.
- On close, focus returns to the Search tab button.
- Body scroll is locked while the overlay is open.

## Top nav (slim mobile variant)

The current top nav stays mounted and remains the only nav at `md+`. Under `md`:

- Visible: logo (left), language selector (right).
- Hidden: category dropdown, Varusteet, Varaosat, Add listing, My listings, user menu, sign-in button. All of these are covered by bottom-nav tabs.

The top nav stays sticky so the brand is always visible. Verify-email banner stays under the top nav, unchanged.

The admin gate (`!isAdmin`) wraps both top and bottom navs — admin routes show neither.

## Styling

Bottom-nav container:

```
fixed bottom-0 inset-x-0 z-40
border-t border-border bg-background
pb-[env(safe-area-inset-bottom)]
md:hidden
```

Each tab:

```
flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs
```

Icon size ~22px. Active state: `text-accent`. Inactive: `text-muted`. Tap state: `active:bg-accent/5`.

Main content offset: `<main>` gets `pb-16 md:pb-0` so its bottom isn't hidden behind the bar.

Icons come from `lucide-react` if already in use; otherwise inline SVGs to avoid adding a dependency. Confirm during implementation.

## Accessibility

- `<nav aria-label="Mobile navigation">` wraps the bar.
- Each tab is a `<Link>` or `<button>` (never a plain `<div>`). Active tab has `aria-current="page"`.
- Each tab has a visible label and is reachable via Tab; visible focus ring.
- Overlay: `role="dialog"`, `aria-modal="true"`, `aria-label="Search"`. Focus trap and Escape-to-close as described.
- Minimum 44×44px tap target for each tab — guaranteed by `py-2 text-xs` plus icon at the chosen viewport.

## Testing

Unit (Vitest):

- Active-state matcher: given pathname X, returns the correct active tab.
- Recent-searches helpers: add, dedupe, cap at 5, read/write to `localStorage`.

E2E (Playwright, mobile viewport):

- Signed-out user taps Search, types `honda`, submits → lands on `/pyorat/myynti?q=honda`.
- Signed-out user taps Add → login modal opens.
- Signed-in user taps Bookings → lands on `/omat`.

## Risks / open questions

- Visual collision with floating action elements on listing detail (booking CTA). Verify during implementation; if needed, gate those floating elements with `md:` so they only show on desktop, or add `bottom-16` offset under `md`.
- Recent-searches in `localStorage` is per-device; acceptable for v1.
- Icon library: defer the exact choice to implementation, but stay consistent with whatever is already used elsewhere.

## Files touched

New:

- `src/components/nav/bottom-nav.tsx`
- `src/components/nav/mobile-search-overlay.tsx`
- Tests alongside each.

Modified:

- `src/routes/__root.tsx` — slim top nav at `< md`, mount bottom nav and overlay state.
- Potentially `src/routes/__root.tsx` `<main>` wrapper or a layout component — add `pb-16 md:pb-0`.
- One Playwright spec for the e2e flow.
