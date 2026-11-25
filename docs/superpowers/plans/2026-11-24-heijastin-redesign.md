# Heijastin redesign implementation plan

> **For agentic workers.** Do the phases in order. Keep all phases on the local `heijastin/redesign` branch. Verify each phase before starting the next. Read "Rules for every phase" before you start a phase. Follow `AGENTS.md` in the repository root. If this plan and `AGENTS.md` disagree, `AGENTS.md` wins, and you say so in the pull request.

**Goal.** Bring the "Heijastin" design from the prototype into the production apps. Motori gets the full redesign. Talli gets the new colours, fonts, and logo, and no layout work.

**Visual reference.** The prototype is in `docs/prototypes/claude-redesign/`. It is the source for layout, spacing, type sizes, and motion. Open `http://localhost:4173/claude-redesign/index.html` on the existing prototype server. If it is unavailable, report that to the product owner. The page `index.html?sivu=kattavuus` lists which features the prototype shows and which ones it only names. The prototype is plain HTML with sample data. Copy its look and its CSS values. Do not copy its JavaScript or its data.

**Tech stack.** TanStack Start, React 19, Tailwind v4, Kysely, BetterAuth, i18next, Embla (gallery), Leaflet (map), Playwright, Vitest. No new runtime library is needed. The only new packages are two font packages.

**Context.** Motori has no users yet. You may delete components and change markup freely. You do not need migration paths for UI state. Keep the public URLs listed under "Decisions".

## Design summary

- **Listings first.** No hero photo. The home page is a feed of listings.
- **One signal colour.** Warm white surface, ink text, and reflector lime. Lime means "saved by you", "selected by you", or "the one primary action on this screen". Lime is always a fill with ink text on it. Lime is never a text colour and never a border on a light surface.
- **Shapes.** Photos and cards have a 10px radius. Chips and buttons are pills. Sheets have a 16px radius. Borders are hairlines. Only sticky bars and sheets have a shadow.
- **No decoration.** No emoji in the UI, no stripes, no gradients over photos, no dark header bands.

## Decisions

The product owner made these decisions on 2026-11-24. Do not reopen them.

1. The plan covers the whole Motori app, in the phases below.
2. `@motori/ui` tokens and fonts change for both apps. Talli gets no layout work. Talli must still pass its tests and look correct.
3. The four category URLs stay: `/pyorat/myynti`, `/pyorat/vuokraus`, `/varusteet`, `/varaosat`. Detail URLs, the `/tori` and `/ilmoitukset` redirects, and `/kauppakirja` stay. `/` becomes a fifth browse page that shows all categories. The category chips are links between these five pages.
4. The home hero, the statistics, and the quick chips go away. The home page keeps one `h1` and a small "Ilmoita pyörä" call after the feed.
5. On mobile, the bottom tab **Haku** becomes **Suosikit**. A search field is always at the top of browse pages. The full-screen search overlay stays and opens from that field.
6. A logged-out user who taps a heart gets the login modal, as today.
7. The rental page stops a date range that crosses an unavailable day in the browser, shows a price breakdown with the saving, and keeps the dates in the URL. The server validation does not change.
8. Fonts change to Bricolage Grotesque (headings, prices, wordmark) and Instrument Sans (all other text). The app hosts both.
9. Motion is the last phase.
10. Tests: update Playwright tests and page objects in every phase. Write new unit tests only for new logic. Do not use a TDD loop for restyling.
11. Add an admin link on the account page, visible only to admins. Fix the two bugs named in Phase 5.
12. The logo becomes the lowercase wordmark `motori` with a lime dot over the `i`. Favicon, app icons, and theme colour change with it.

## Rules for every phase

- Use `pnpm`. Run one shell command at a time. Use port 3011 for local Motori servers and browser tests. Port 4173 serves the prototype.
- UI copy is Finnish. Add every new string to both `apps/motori/src/lib/i18n/resources/fi/*.ts` and `apps/motori/src/lib/i18n/resources/en/*.ts`. No test compares the two languages, so compare the keys yourself.
- Keep every `data-testid` that this plan does not tell you to change. When you change one, change the page object in `apps/motori/e2e/pages/` in the same commit. Selectors stay in page objects.
- Do not put lime text on a light surface. `e2e/tests/a11y.spec.ts` runs axe on `/`, `/pyorat/vuokraus`, and the auth pages, and a contrast failure fails CI.
- Every POST server function keeps its middleware order (`AGENTS.md`, "Security"). This plan adds no new POST server function.
- Do not add `node:*` imports to files that the client bundle can reach.
- Do not edit `routeTree.gen.ts` by hand. Commit what the generator writes.
- Comments: only where the reason is not obvious from the code.
- Before you open the pull request, run each of these and fix every failure:
	1. `pnpm lint`
	2. `pnpm format`
	3. `pnpm typecheck`
	4. `pnpm test`
	5. `pnpm build`
	6. `pnpm test:e2e`
	7. `pnpm test:e2e:talli` (only in phases that change `packages/ui` or `apps/talli`)
- After the build, start the production server with `node apps/motori/.output/server/index.mjs` and open the pages that the phase changed. Look for CSP violations in the browser console. The dev server hides them.
- Compare each changed page with the prototype at 390×844 and at 1280×800. Put one before and one after screenshot per changed page in the pull request.
- Commit messages have no `Co-Authored-By` line.
- If a step is unclear or a fact in this plan is wrong, stop and write the question in the pull request. Do not guess a product decision.

## Token mapping

The current theme is one `@theme` block in `packages/ui/src/theme.css`. Phase 1 changes it to the values below.

| Token | New value | Meaning |
|---|---|---|
| `--color-background` | `#f7f6f2` | page surface ("paper") |
| `--color-foreground` | `#15181a` | text ("ink") |
| `--color-card`, `--color-popover` | `#ffffff` | raised surface |
| `--color-card-foreground`, `--color-popover-foreground` | `#15181a` | |
| `--color-primary` | `#15181a` | ink fill (secondary buttons, active chip) |
| `--color-primary-foreground` | `#ffffff` | |
| `--color-muted` | `#5a605d` | secondary text |
| `--color-muted-foreground` | `#5a605d` | |
| `--color-muted-light`, `--color-secondary` | `#eeede7` | chip and input fill ("tint") |
| `--color-secondary-foreground` | `#15181a` | |
| `--color-border`, `--color-input` | `#e3e1da` | hairline |
| `--color-ring` | `#15181a` | focus ring |
| `--color-reflector` (new) | `#d6f83c` | lime fill |
| `--color-reflector-press` (new) | `#c2e622` | lime fill, hover and pressed |
| `--color-reflector-soft` (new) | `#ecfba6` | selected date range band |
| `--color-destructive` | `#b3261e` | |
| `--color-success` | `#1f6b3a` | |
| `--color-warning` | keep | |
| `--color-accent` | `#15181a` | temporary, see below |
| `--color-accent-hover` | `#2a2f32` | temporary |
| `--color-accent-light` | `#d6f83c` | temporary, used on dark surfaces only |
| `--color-accent-foreground` | `#ffffff` | temporary |
| `--radius-lg` | `0.625rem` | photos and cards |
| `--radius-sheet` (new) | `1rem` | sheets and dialogs |
| `--font-heading` | `"Bricolage Grotesque Variable", system-ui, sans-serif` | |
| `--font-sans` | `"Instrument Sans Variable", system-ui, sans-serif` | |
| `--font-mono` | keep | |

**Why `accent` becomes ink.** About 175 class usages in Motori use `accent`, and about 60 of them are `text-accent`. Lime text on white fails contrast. With `accent` set to ink, every existing usage stays readable on the day Phase 1 merges. Later phases move each real primary action to `bg-reflector text-foreground hover:bg-reflector-press`. Phase 8 deletes the `accent` tokens.

**Rule for each `accent` usage you touch.**

- `text-accent`, `border-accent`, `ring-accent`: replace with `text-foreground`, `border-foreground`, or the standard focus ring.
- `bg-accent … text-white` on the one primary action of a screen: replace with `bg-reflector text-foreground hover:bg-reflector-press`.
- `bg-accent … text-white` on any other button: replace with `bg-primary text-primary-foreground`.
- A screen has at most one lime button. A "saved" or "selected" state can also be lime.

**Contrast values.** Ink on paper is 16.5:1. Muted text `#5a605d` is 5.95:1 on paper, 5.48:1 on tint, and 6.43:1 on white. Ink on lime is 14.7:1. `AGENTS.md` requires that you compute the contrast before you lighten a token. Do not lighten these.

**Focus ring.** Every interactive element shows `outline: 2px solid` ink with a 2px offset, plus a lime `box-shadow` halo. Copy the rule from the prototype `styles.css`.

---

## Phase 1: tokens, fonts, logo, and shared components

**Result.** Both apps use the new colours, fonts, and logo. Layouts are unchanged, so some pages look unfinished. That is expected.

**Files.**

- `packages/ui/src/theme.css`
- `packages/ui/src/button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`
- `apps/motori/src/routes/__root.tsx`, `apps/talli/src/routes/__root.tsx` (font imports, `theme-color`)
- `apps/motori/src/components/logo.tsx`, and the logo that Talli renders
- `apps/motori/public/` and `apps/talli/public/`: `favicon.svg`, `favicon.ico`, `app-icon.svg`, `icon-192`, `icon-512`, maskable icon, `manifest.webmanifest`
- `apps/motori/src/styles/app.css` (map badges, `card-hover`, `.rdp-*`)
- `packages/server/src/email-wrapper.ts` and the email templates

**Steps.**

- [x] **1.1** Add `@fontsource-variable/bricolage-grotesque` and `@fontsource-variable/instrument-sans` to both apps. First run `pnpm view <package> version` to confirm that each package exists. Import them in both `__root.tsx` files where the Manrope import is now. Remove the Manrope and Space Grotesk imports and packages. Keep JetBrains Mono. The CSP `font-src 'self' data:` already allows the bundled files.
- [x] **1.2** Change `theme.css` to the token mapping above.
- [x] **1.3** Set `font-variant-numeric: tabular-nums` on prices. Add a small utility class in `theme.css` if no Tailwind utility fits.
- [x] **1.4** Change `Button` in `packages/ui/src/button.tsx`. All variants become pills (`rounded-full`). `default` stays an ink fill. Add a variant `reflector` (`bg-reflector text-foreground hover:bg-reflector-press`). `outline` and `ghost` hover with `bg-muted-light`, not `bg-accent`. Minimum height 44px for `default` and `lg`.
- [x] **1.5** Change `Input`, `Select`, and `Textarea` to a `bg-card` fill with a `border-input` hairline, a 10px radius, and the focus ring above.
- [x] **1.6** Replace the logo with the wordmark: lowercase `motori`, Bricolage Grotesque weight 800, ink, with a small lime circle over the `i`. Copy the construction from `.wordmark` in the prototype. The logo component needs a light variant only, because no dark header remains after Phase 2. Until Phase 2 lands, the Motori header is `bg-primary`, so also keep a variant with white text.
- [x] **1.7** Redraw the favicon and the app icons: ink square with rounded corners, white lowercase `m`, lime dot at the top right. Set `theme-color` and the manifest `theme_color` to `#f7f6f2`, and the manifest `background_color` to `#f7f6f2`, in both apps.
- [x] **1.8** Run `grep -rniE "ad5016|a34b13|1a1a2e|e07a3a|c4631e|2d2540" apps packages --exclude-dir=node_modules --exclude-dir=.output`. Replace every hard-coded old colour with the matching new value or token. This includes the email wrapper, the map badge styles in `app.css`, and the gradient in `booking-pricing.tsx`.
- [x] **1.9** Open every Talli page. Fix only contrast or legibility problems that the new tokens cause. Do not change the Talli layout.

**Acceptance.**

- No page in either app shows orange or the dark blue `#1a1a2e`.
- Headings render in Bricolage Grotesque and body text in Instrument Sans in the production build. `ä` and `ö` render in both fonts.
- All checks pass, including `pnpm test:e2e:talli`.

**Accepted Phase 1 exception (2026-11-24).** Talli’s document scanner fails to load at `/pyorat/$vehicleId/skannaa`. Open a vehicle and select **Skannaa dokumentti** to reproduce it. The production Content Security Policy blocks the scanner’s attempt to evaluate a JavaScript string. The original build and the Phase 1 build both showed the same error at 390×844 and 1280×800. The product owner accepted this exception for Phase 1. The scanner still needs a separate fix that works with the current policy.

---

## Phase 2: app shell

**Result.** The header, the mobile tab bar, and the footer match the prototype on every Motori page.

**Files.**

- `apps/motori/src/routes/__root.tsx`
- `apps/motori/src/components/nav/bottom-nav.tsx`, `active-tab.ts`, `active-tab.test.ts`, `mobile-search-overlay.tsx`, `category-dropdown.tsx` (delete)
- `apps/motori/src/components/auth/user-menu.tsx`
- `apps/motori/src/components/language-selector.tsx`
- `apps/motori/src/lib/favorites-context.tsx`
- New: `apps/motori/src/components/nav/site-search.tsx`
- Page objects and specs: `home.page.ts`, `mobile-bottom-nav.spec.ts`, `mobile-city-combobox.spec.ts`, `mobile-make-model-dropdown.spec.ts`, `language-selector.spec.ts`

**Steps.**

- [x] **2.1 Header, desktop (≥ `md`).** One row on the paper surface with a hairline under it: wordmark, search field (max width 560px), then **Suosikit** with a count badge, **Viestit** with the unread badge, **Oma** (the user menu), the language selector, and the lime pill **Myy**. Remove the dark `bg-primary` band and `CategoryDropdown`. Categories are reachable from the chips (Phase 3) and from the footer.
	- **Myy** keeps `data-testid="nav-add-listing"` and its three states: link for a verified user, login modal for a logged-out user, disabled with the tooltip for an unverified user.
	- Logged out: **Suosikit**, **Viestit**, and **Oma** open the login modal. Keep `nav-login`.
	- The user menu lists: Omat ilmoitukset, Varaukset, Tallennetut haut, Asetukset, Kirjaudu ulos. Keep `nav-user-menu`, `nav-dashboard`, and `nav-signout`.
- [x] **2.2 Header, mobile.** Row 1: wordmark on the left. On the right: `nav-login-mobile` when logged out, and the language selector. Row 2, only on the five browse pages: the search trigger from step 2.4.
- [x] **2.3 Language selector.** Show both languages as `FI | EN`, with the current one in bold. Each is a button with `aria-pressed`. Persistence does not change. Update `language-selector.spec.ts` through its page object.
- [x] **2.4 Search.** Create `SiteSearch`.
	- Desktop: a real `<input type="search">` in a `<form>`. On submit it navigates to the current browse page with `q` set and `cursor` cleared. On a page that is not a browse page it navigates to `/pyorat/myynti` with `q` (Phase 3 changes this target to `/`). Test ids: `site-search-form`, `site-search-input`.
	- Mobile: a button that looks like the field, shows the current `q` or the placeholder "Hae pyörää, varustetta tai varaosaa", and opens `MobileSearchOverlay`. Test id: `site-search-trigger`.
	- Remove the search forms inside `routes/index.tsx` and `browse-page.tsx` only in Phase 3. In this phase both can exist.
- [x] **2.5 Favourites count.** Expose `count` (`ids.size`) from `favorites-context.tsx`. Show it in a lime badge on **Suosikit** in the header and in the tab bar. Hide the badge at 0. The badge has a screen-reader text, for example "3 suosikkia".
- [x] **2.6 Bottom tab bar.** Five items: **Selaa** (`/`, `bottom-nav-browse`), **Suosikit** (`/omat/suosikit`, new id `bottom-nav-favorites`), **Myy** (centre, 44px lime circle with an ink plus, `bottom-nav-add`, the same three states as today), **Viestit** (`bottom-nav-messages`, with the unread badge), **Oma** (`bottom-nav-account`). Remove the search tab and `bottom-nav-search`. The active item uses ink and weight 600, not a colour. Pass the unread count from the root `beforeLoad` to `BottomNav`.
- [x] **2.7 `active-tab.ts`.** Add the value `favorites` for `/omat/suosikit`. Check this path before the `/omat*` rule. Update `active-tab.test.ts`.
- [x] **2.8 Search overlay.** Restyle `MobileSearchOverlay` with the new tokens. Add a category chip "Kaikki" in Phase 3, not now. Behaviour does not change.
- [x] **2.9 Footer.** One hairline, links in muted text. Keep all current links and the version text.
- [x] **2.10 Layout variables.** Define the heights of the header, the tab bar, and the sticky action bar as CSS variables in `app.css` (the prototype uses 52px, 64px, and 68px). `main` gets bottom padding for the tab bar plus `env(safe-area-inset-bottom)` on mobile. Later phases use these variables. Do not hard-code these heights elsewhere.
- [x] **2.11 Tests.** `mobile-bottom-nav.spec.ts` and `mobile-city-combobox.spec.ts` open the overlay with `bottom-nav-search`. Change them to `site-search-trigger`. They must start on a browse page. Add a test: a logged-out tap on `bottom-nav-favorites` opens `login-modal`.

**Acceptance.**

- At 390px: wordmark row, tab bar with five items, no horizontal scroll on any page.
- At 1280px: one header row, no tab bar.
- `/admin` still has no shell. `/viestit` still has no footer.
- Keyboard: Tab reaches every header item in visual order, and each shows the focus ring.

---

**Phase 2 verification (2026-11-24).** All six required commands passed. The unit suite passed 474 tests. Motori’s browser suite passed 146 tests and skipped 9. Production checks covered the desktop keyboard order, focus ring, signed-in counts, guest login prompts, and search with an existing category filter. The page checks at 390×844 and 1280×800 found no horizontal overflow or CSP violations. The missing-page check returned HTTP 404 as expected.

## Phase 3: listing card, home feed, and the "all categories" query

**Result.** `/` is a feed of all categories with the new card. The four category pages show the new card in the old page layout until Phase 4.

**Files.**

- `apps/motori/src/components/listings/listing-card.tsx`, `listing-card.test.tsx`, `listing-card-skeleton.tsx`, `favorite-button.tsx`
- `apps/motori/src/lib/listings-search.ts`, `search.test.ts`, `validators.ts`, `validators.test.ts`, `category-routes.ts`
- `apps/motori/src/routes/index.tsx`
- `apps/motori/src/lib/i18n/resources/{fi,en}/home.ts`, `listings.ts`
- `e2e/pages/home.page.ts`, `e2e/tests/home.spec.ts`, `e2e/tests/unverified.spec.ts`

**Steps.**

- [x] **3.1 Query.** `searchListings` and `getLatestListings` require a category today, and `applyFilters` filters on it. Add the value `"all"`.
	- With `"all"`, the query returns active listings of every category, ordered by `created_at` descending, with the same cursor pagination and `totalCount`.
	- The price comes from a different child table per category. `getFavoriteListingsFn` and the profile page already build such mixed rows with left joins. Read them and reuse that shape. Do not write a second mixed query from nothing.
	- `"all"` supports `q`, `region`, `city`, `price_min`, `price_max`, `condition`, `sort`, and `cursor`. It ignores the category-specific filters.
	- Also return `size` and `gear_type` for gear rows and `part_category` for part rows, in every category. The card needs them.
	- Add unit tests next to the existing search tests for: mixed results, price sort across categories, and the cursor.
- [x] **3.2 Card.** Rebuild `ListingCard` to match `.card` in the prototype.
	- Photo tile with a 4:5 ratio and a 10px radius. Use `srcSet` with the thumbnail (400w) and the main image (1600w), and `sizes` that match the grid.
	- Under the photo, in this order: price (heading font, weight 700, about 17px; rentals show "95 € / vrk"), title (one line with an ellipsis, `listing-card-title`), facts line in muted text (`listing-card-facts`).
	- Facts line: sale "2008 · 34 200 km · Turku". Rental "2008 · 599 cc · Turku". Gear "Koko M · Hyvä · Helsinki". Part "Jarrut · Hyvä · Lahti", with the Finnish label of the part category, not the raw value. Leave out a value that is missing.
	- Remove: the emoji type line, the licence badge, the "Uusi" badge, the photo count, the dark gradient, the region name, and the card border.
	- Keep: the "Oma" badge, the status badge (`listing-card-status`), `data-testid="listing-card"`, `data-listing-id`, and the link target.
	- Rentals show a small ink pill "Vuokra" at the bottom left of the photo.
	- The heart is a sibling of the link, not a child. A tap on the heart must not navigate.
- [x] **3.3 Heart.** `FavoriteButton` default style: a 36px white circle at the top right of the photo, with a 44px hit area. Saved state: lime fill with an ink heart, `aria-pressed="true"`. Labels: "Tallenna suosikkeihin: {title}" and "Poista suosikeista: {title}". The glint animation comes in Phase 8.
- [x] **3.4 Grid.** One grid utility for all listing grids: 2 columns below 640px (gap 10px, row gap 22px), 3 from 640px, 4 from 900px, 5 from 1200px. Page content has a max width of 1240px.
- [x] **3.5 Home route.** Rewrite `routes/index.tsx`.
	- Loader: one call, `searchListings` with `category: "all"` and the validated search params (`browseSearchSchema`). Remove the four `getLatestListings` calls and `getHomepageStats` if nothing else uses it.
	- Page: the chip row placeholder (Phase 4 builds the shared one; for now render the five category links as chips), `h1` "Uusimmat ilmoitukset" or "Hakutulokset" when `q` or a filter is set, the result count, the grid, the "load more" button, and then the "Ilmoita pyörä" call with `home-add-listing-cta` and its disabled state for unverified users.
	- Remove the hero, the image `kawasaki-ninja-rider-sunset-*` usage, the statistics, the quick chips, the category showcase, and the tab bar inside the page. Delete the translation keys that become unused.
	- Keep the canonical link.
- [x] **3.6 Search target.** Change `SiteSearch` so that a page that is not a browse page navigates to `/` with `q`. Add "Kaikki" as the first category chip in `MobileSearchOverlay`, and make it the default when the current page is `/`. On Kaikki, selecting a city filters listings across all categories. Show the selected city with a control to clear it.
- [x] **3.7 Tests.**
	- `listing-card.test.tsx`: assert the new facts lines, the price format, the rental pill, and that the heart is outside the link. Remove the assertions for the removed elements.
	- `home.spec.ts`: replace the hero test with "the feed heading and at least one card are visible". The search test expects `/?q=Honda`. Replace the quick-chip test with "the chip Varusteet navigates to `/varusteet`". Keep the CTA test.
	- Update `home.page.ts` (remove `home-hero-heading`, `home-search-*`, `home-chip-*`).

**Acceptance.**

- `/` shows sale, rental, gear, and part listings in one grid, newest first, and "load more" works.
- A tap on a heart on `/` saves the listing and the URL does not change.
- The a11y test passes on `/`.

**Phase 3 verification (2026-11-24).** All six required commands passed. The unit suite passed 471 tests. Motori’s browser suite passed 146 tests and skipped 9. The production feed showed the same 19 listings in the same order as PostgreSQL across two pages. Selecting Helsinki or Espoo returned the matching listings across categories. Reload kept the city and clearing it restored the full feed. Production browser checks found no console errors or CSP violations on the pages tested at 390×844 and 1280×800.

---

## Phase 4: browse pages, filters, and map

**Result.** The five browse pages share one layout that matches the prototype feed, filter panel, and map.

**Files.**

- `apps/motori/src/components/listings/browse-page.tsx`, `mobile-browse-controls.tsx` (delete or merge), `filter-drawer.tsx`, `filter-sidebar.tsx` (delete), `collapsible-sidebar.tsx` (delete), `filter-controls.tsx`, `filter-compositions.tsx`, `save-search-button.tsx`, `empty-state.tsx`, `listings-map.tsx`, `range-input.tsx`, `city-select.tsx`, `make-model-select.tsx`
- The four category index routes and `routes/index.tsx`
- `apps/motori/src/styles/app.css`
- `e2e/pages/listings.page.ts`, `e2e/tests/listings.spec.ts`, `categories.spec.ts`, `mobile-make-model-dropdown.spec.ts`

**Steps.**

- [x] **4.1 One page component.** `/` renders `BrowsePage` with `category="all"`, `browseTo="/"`, `showMap={false}`, and a new `AllFilters` composition (`RegionFilter`, `ConditionFilter`, `PriceFilter`, `SortFilter`). Remove the temporary chip row from Phase 3.
- [x] **4.2 Remove the dark search band** from `BrowsePage`, with its form. `SiteSearch` replaces it. Remove `listings-search-input` and `listings-search-submit` from the page object and use the `site-search-*` ids.
- [x] **4.3 Feed bar.** Under the header:
	- Row 1: category chips as links: Kaikki (`/`), Pyörät (`/pyorat/myynti`), Vuokraus (`/pyorat/vuokraus`), Varusteet (`/varusteet`), Varaosat (`/varaosat`). The active chip is an ink fill with white text and `aria-current="page"`. A chip link carries `q` and `region` to the next page and drops all other params. On mobile this row scrolls sideways alone.
	- Row 2 on mobile, same row on desktop: **Suodata** with the active filter count in a lime badge (`listings-filter-drawer-toggle`), the sort control, and, where `showMap` is true, the **Lista / Kartta** toggle (`listings-view-toggle`).
	- On mobile the header search row and the feed bar stick to the top together.
- [x] **4.4 Heading row.** `h1`: "Uusimmat ilmoitukset", or "Hakutulokset" when `q` or a filter is set. Then the result count (`listings-total-count`, `aria-live="polite"`, one element for all screen sizes; remove the `-mobile` duplicates and update the page object), the region label, and `SaveSearchButton` on the right. `SaveSearchButton` keeps its rules: disabled without `q` or a filter, login modal when logged out.
- [x] **4.5 Active filter chips.** Move the removable filter chips from the sidebar to a row under the feed bar. Show the row only when a filter is active. It ends with "Tyhjennä kaikki".
- [x] **4.6 One filter panel.** Delete the desktop sidebar. `FilterDrawer` becomes the only filter UI: a bottom sheet on mobile (max height 85vh) and a right-side panel 380px wide on desktop. Keep the focus trap, Escape, and focus return. The footer has "Tyhjennä kaikki" and the lime button "Näytä N ilmoitusta".
	- The sidebar and the drawer use two test id prefixes today (`filter-` and `drawer-`). Keep `filter-` only, and update `listings.page.ts`.
	- Restyle the controls in `filter-controls.tsx`: pill toggles for type, licence, size, condition, gear type, and part category. A selected pill is an ink fill. Remove the emoji from the type toggles.
	- URL behaviour does not change: each change navigates with `replace: true` and clears `cursor`.
- [x] **4.7 Grid and loading.** Use the grid from Phase 3. Restyle `ListingCardSkeleton` to the 4:5 tile. Restyle "load more" as an outline pill.
- [x] **4.8 Empty state.** Restyle `EmptyState` and `LowResultNudge`. Keep their logic and the `listings-empty-state` id.
- [x] **4.9 Map.** Keep Leaflet and the URL behaviour (`view`, `city`, push on pin click, push on panel close, push on toggle).
	- Pins: an ink circle with the count in white. The selected pin is lime with an ink count and an ink ring. Change the badge styles in `app.css`.
	- Layout: replace the hard-coded heights `calc(100dvh-293px)` and `calc(100dvh-152px)` with a layout that uses the variables from step 2.10.
	- City panel (`map-city-panel`): under the map on mobile, a left column 360px wide on desktop, with the heading "Turku · 2 ilmoitusta", the close button (`map-city-panel-close`), and the same cards.
- [x] **4.10 Tests.** `listings.spec.ts` must still prove: the toggle sets and removes `view=map`; `city` opens the panel; closing removes `city`; browser Back from a listing returns to the map with the same city; browser Back from the map returns to the list. Add a test for the chip links (the chip Vuokraus on `/varusteet?q=x` lands on `/pyorat/vuokraus?q=x`).

**Acceptance.**

- The five browse pages differ only in data, filter blocks, and the map toggle.
- At 1280px the grid has 5 columns and no sidebar.
- The filter panel is usable with the keyboard only.

**Phase 4 verification (2026-11-25).** All six required commands passed on the local setup. The unit suite passed 471 tests. Motori’s browser suite passed 148 tests and skipped 9. On port 3011 the production build passed the keyboard, saved-search and map-history checks. Captures at 390×844 and 1280×800 showed no horizontal overflow, browser console errors or CSP violations. The existing CARTO tile endpoint returns images marked “API KEY REQUIRED” in both the baseline and the redesigned app. The city pins and panel work, but the geographic background is unavailable with the current configuration.

---

## Phase 5: listing pages and seller profile

**Result.** The sale, gear, and part pages match the prototype listing page. The rental page gets the same shell. The rental booking panel changes in Phase 6.

**Files.**

- `apps/motori/src/components/listings/listing-detail-shell.tsx`, `listing-gallery.tsx`, `non-rental-sidebar.tsx`, `non-rental-sidebar.test.tsx`, `message-seller-button.tsx`, `share-button.tsx`, `apps/motori/src/components/report-button.tsx`
- `apps/motori/src/lib/listings-detail-route.ts` (or `.tsx`), the detail routes under `routes/pyorat/myynti`, `routes/varusteet`, `routes/varaosat`, `routes/pyorat/vuokraus`
- `apps/motori/src/routes/profiili/$userId.tsx`
- `e2e/pages/listing-detail.page.ts`, `tori-detail.page.ts`, `listings.spec.ts`, `tori-lifecycle.spec.ts`, `sale-contract.spec.ts`, `reviews.spec.ts`

**Steps.**

- [ ] **5.1 Shell layout.**
	- Mobile order: back row, gallery, price, title, meta chips, fact grid, description, seller card, bill-of-sale row (sale only), report link.
	- Desktop: two columns with a 1240px max width. Left: title, meta chips, gallery, fact grid, description. Right: a sticky card 360px wide with the price, the contact buttons, the seller card, and the bill-of-sale row. Keep the DOM order the same as the visual order on desktop (title before gallery), so that keyboard order is correct.
	- Back row: "‹ Takaisin" on the left (`listing-detail-back`), share and heart on the right as 44px round buttons. If the router can go back inside the app, the back control calls history back. Otherwise it links to the category page. Check whether the installed TanStack Router has `useCanGoBack` and use it if it exists.
	- Keep the sold and expired banners, the "Oma" badge, and the status badge.
- [ ] **5.2 Price and facts.** Move the price and the fact rows out of `NonRentalSidebar` into the shell's main column on mobile. `NonRentalSidebar` keeps the contact actions and the owner actions. The price is in the heading font, weight 800, about 30px, with "Hinta joustaa" beside it. Keep `price-info` and `price-sale`. The fact grid has two columns of label and value with hairlines between rows.
	- Facts per category. Sale: Vuosimalli, Kilometrit, Kuutiotilavuus, Teho, Kunto, Väri, Omistajia, Vaihto. Gear: Tyyppi, Merkki, Koko, Kunto. Part: Osaluokka, Sopii, OEM-numero, Kunto. Rental: Vuosimalli, Kuutiotilavuus, Ajokortti, Kilometriraja.
	- **Bug fix.** The part page shows the raw `part_category` value (for example "brakes"). Show the Finnish label from the constants.
	- **Bug fix.** Several cards use the class `rounded-l`, which rounds only the left corners. Replace it with the card radius. Run `grep -rn "rounded-l " apps/motori/src` to find them.
- [ ] **5.3 Gallery.** Keep Embla and the lightbox. Restyle: edge to edge with a 4:3 ratio on mobile, a counter pill "1 / 4" at the bottom right, dots at the bottom centre. On desktop: a large main image with a 10px radius and a thumbnail strip under it, where the current thumbnail has an ink ring. The lightbox has a dark backdrop and round white controls.
- [ ] **5.4 Contact.**
	- Mobile: a sticky bar above the tab bar for sale, gear, and part pages, shown to non-owners when the listing is active. Left: the price. Right: the lime button "Lähetä viesti" (`MessageSellerButton`), or "Kirjaudu ottaaksesi yhteyttä" (`login-to-contact`) when logged out. When the seller shows a phone number, add a round outline button with a phone icon.
	- The phone number is not in the page until the user asks for it: the button "Näytä puhelinnumero" swaps to a `tel:` link with the number.
	- Desktop: the same actions in the sticky right card.
	- The spacer under the page content uses the action bar variable from step 2.10.
- [ ] **5.5 Seller card.** Initial avatar, name, rating ("★ 4,7 (3 arvostelua)" or "Ei vielä arvosteluja"), city, "Jäsen vuodesta 2023", and a chevron. The whole card is the link (`seller-profile-link`). Draw the star as SVG.
- [ ] **5.6 Bill-of-sale row.** A bordered row with a document icon, the title "Tee kauppakirja", and the line "Esitäyttää ajoneuvon tiedot ja hinnan. Nimet ja muut tiedot pysyvät selaimessasi." The link text must still match the role query `link "Tee kauppakirja"` in the tests. The target does not change (`/kauppakirja?ilmoitus=<short_id>`).
- [ ] **5.7 Owner view.** The owner sees "Muokkaa" and "Omat ilmoitukset" as outline pills in place of the contact actions, and no sticky contact bar. Keep `listing-edit-link`.
- [ ] **5.8 Seller profile.** Restyle `/profiili/$userId`: header with avatar, name, city, member since, and the rating. Then the review list (name, date, stars, comment). Then the active listings in the shared grid. Change the back link target from `/ilmoitukset` to `/`.
- [ ] **5.9 Tests.** Update `non-rental-sidebar.test.tsx` for the moved price and facts. Add a unit test for the part category label. Update the page objects. `reviews.spec.ts` and `sale-contract.spec.ts` must pass without logic changes.

**Acceptance.**

- At 390px the sticky contact bar never covers the last content line or the tab bar.
- One tap on a card photo or title opens the listing page. The heart only saves.
- The detail pages of all four categories render with their own fact rows.

---

## Phase 6: rental booking

**Result.** The rental page matches the prototype: price ladder, calendar with availability, live breakdown, and the request step.

**Files.**

- `apps/motori/src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`
- `apps/motori/src/components/listings/booking-request-form.tsx`, `booking-calendar.tsx`, `booking-pricing.tsx`, `booking-pricing.test.tsx`, `availability-calendar.tsx`
- `apps/motori/src/lib/bookings.ts`, `bookings.test.ts`, `calendar-helpers.ts`, `calendar-helpers.test.ts`
- `apps/motori/src/components/ui/mobile-fullscreen-modal.tsx`
- `e2e/pages/listing-detail.page.ts`, `e2e/tests/booking.spec.ts`

**Steps.**

- [ ] **6.1 Cost breakdown (new logic, unit tests first).** Extend `computeBookingCost` in `lib/bookings.ts`. Keep the current rules and the current fields. Add:
	- `lines`: the rows to show. Examples: `{ kind: "weekend", cents }`, `{ kind: "week", count: 1, cents }`, `{ kind: "day", count: 2, unitCents, cents }`.
	- `savingsCents`: `days × day price − totalCents`, or 0 when that is not positive.
	- The rules stay: days are inclusive. Exactly 3 days from Friday to Sunday with a weekend price set gives the weekend price. Otherwise 7 or more days with a week price set gives `floor(days / 7)` weeks plus the remaining days at the day price. Otherwise days times the day price.
	- Tests: a Friday to Sunday range, 9 days with a week price (1 week plus 2 days), 9 days without a week price, 1 day, and a 3-day range that does not start on Friday.
- [ ] **6.2 Range validation (new logic, unit tests first).** `computeNewRange` in `calendar-helpers.ts` clamps to `MAX_STAY` only. Add a check: if any day between the start and the end is blocked, return only the new start and a reason `"blocked"`. `BookingCalendar` already computes blocked days in `isBlocked`. Move that rule into a pure function in `calendar-helpers.ts` so that both use it.
	- Messages: "Valinnassa on varattu päivä. Valitse yhtenäinen vapaa jakso." and, for the clamp, "Enintään 30 päivää kerrallaan."
	- The server check in `bookings.server.ts` does not change.
- [ ] **6.3 Dates in the URL.** Add `from`, `to` (ISO dates), and `step` (`"request"`) to the route's `validateSearch`. Ignore invalid, past, or blocked values. The selected range lives in the URL (navigate with `replace: true`), not in `useState`. A reload keeps the dates. Add `from`, `to`, and `step` to nothing else: the canonical link and `og:url` stay without them.
- [ ] **6.4 Price ladder.** Under the title: one bordered row with up to three cells, "Päivä 95 €", "Viikonloppu pe–su 240 €", "Viikko 550 €". Show a cell only when that price is set. The cell whose rule applies to the current selection gets an ink ring. Keep `price-per-day`, `price-per-week`, and `price-per-weekend`. Show `price_description` under the row.
- [ ] **6.5 Calendar.** Restyle `BookingCalendar` to match `.cal` in the prototype.
	- Monday first. One month on mobile with previous and next buttons, two months on desktop.
	- Selected range: a `bg-reflector-soft` band, with the two end days as full lime circles with ink text.
	- Unavailable days: muted text with a diagonal strike, `aria-disabled="true"`.
	- Today: a small ink dot under the number.
	- Legend: "Vapaa", "Varattu", "Valintasi".
	- Each day button has an `aria-label` such as "perjantai 4. joulukuuta, vapaa". Keep the existing keyboard support.
	- The owner's `AvailabilityCalendar` on the edit page gets the same day styles.
- [ ] **6.6 Summary.** Replace `CalendarHero`, `TicketCard`, and `CalendarFooter` in `booking-pricing.tsx` with one summary card: "Nouto pe 4.12." and "Palautus su 6.12.", the rows from `lines`, "Yhteensä" with the total in the heading font at weight 800, and a lime tag "Säästät 45 €" when `savingsCents` is above 0. Without a selection: "Valitse nouto- ja palautuspäivä nähdäksesi hinnan." The total is in an `aria-live="polite"` region.
	- `booking-pricing.test.tsx` selects by CSS classes today. Rewrite it to select by text and test ids.
- [ ] **6.7 Request step.**
	- Mobile: a sticky bar above the tab bar. Before a selection: "95 € / vrk" and the button "Valitse päivät", which scrolls to the calendar. After a selection: "Yhteensä 240 € · 3 päivää" and the lime button "Jatka pyyntöön" (`mobile-book-button`), which sets `step=request` with a push navigation. With `step=request`, `MobileFullscreenModal` shows the request form. Browser Back closes it and keeps the dates.
	- The calendar is in the page on mobile now, not inside the modal.
	- Desktop: the sticky right card holds the ladder, the calendar, the summary, the message field, and the submit button. `step` has no effect on desktop.
	- Request form: a short listing summary, the dates and the breakdown, the required message (max 500 characters, with a counter and an inline error), the line "Pyyntö ei sido sinua. Omistaja vahvistaa tai hylkää pyynnön, ja saat omistajan yhteystiedot vahvistuksen jälkeen.", and the lime button "Lähetä varauspyyntö".
	- Logged out: show the calendar and the summary. The button is "Kirjaudu varataksesi" and links to `/kirjaudu?redirect=` with the current path and the `from` and `to` params.
	- Success: "Pyyntö lähetetty", the status pill "Odottaa", and the links "Näytä varaukseni" (`/omat/varaukset`) and "Takaisin ilmoitukseen".
	- A server error `dates_unavailable` shows the blocked-range message and clears the selection.
- [ ] **6.8 Secondary actions.** "Lähetä viesti" as an outline pill under the booking card for logged-in non-owners. The report link stays.
- [ ] **6.9 Tests.** `booking.spec.ts` must still prove the full flow: the renter submits, the owner confirms, the contact is revealed. Add: a reload keeps the selected dates, and a range across a booked day shows the message. Keep the selectors in `listing-detail.page.ts`.

**Acceptance.**

- A Friday to Sunday selection on a listing with a weekend price shows the weekend row, the total, and the saving.
- A range across an unavailable day cannot be selected in the browser.
- The calendar and the request form work with the keyboard only.

---

## Phase 7: remaining pages

**Result.** Every Motori page uses the new design. No page shows the old header band, orange, or `bg-accent` primary buttons.

Restyle these pages with the tokens, the shared button variants, the grid, and the layout variables. Do not change behaviour except where a step says so.

- [ ] **7.1 Account page `/omat`.** Header with avatar, name, and "N aktiivista / M tauolla". Under it, a list of rows that link to Suosikit, Tallennetut haut, Varaukset, Viestit, Asetukset, and Kirjaudu ulos. Then the listing management list with its tabs, statuses, and row actions unchanged (Tee kauppakirja, Muokkaa, Aseta tauolle or Aktivoi, Myyty, Jatka voimassaoloa, Poista), and the disabled states for unverified users. Row actions are outline pills. "Poista" uses the destructive colour.
- [ ] **7.2 Admin link.** On `/omat`, show a row "Ylläpito" that links to `/admin` only when the session user is an admin. Use the same check that `requireAdmin` uses. Do not send the role to users who are not admins. Add an e2e test in `admin.spec.ts`: the admin sees the row, a normal user does not.
- [ ] **7.3 Favourites `/omat/suosikit` and saved searches `/omat/haut`.** Shared grid for favourites, with an empty state that names the heart. Saved searches are rows with the label, a chevron, and a delete button.
- [ ] **7.4 Bookings `/omat/varaukset` and the booking detail.** Tabs as an ink segmented control. Status as a pill: "Odottaa" on tint, "Vahvistettu" lime, "Hylätty" and "Peruttu" outlined, "Vanhentunut" muted. On the detail page, "Vahvista varaus" is the lime button and "Hylkää" is an outline button. The review form and its states keep their logic.
- [ ] **7.5 Messages `/viestit` and the thread.** Two panes on desktop, one on mobile. Own messages are an ink fill with white text. Other messages are white with a hairline. Booking request messages stay centred pills on tint. The send button is the lime primary action. Keep the SSE updates, the mobile back link to `/viestit`, and the hidden footer. `mobile-chat-back.spec.ts` must pass.
- [ ] **7.6 Settings `/profiili/asetukset` and `/taydenna-profiili`.** Sections with hairlines. "Tallenna" is the lime button of the form. "Poista tili" uses the destructive colour.
- [ ] **7.7 Auth pages and the login modal.** `/kirjaudu`, `/rekisteroidy`, `/unohdin-salasanan`, `/vaihda-salasana`, `/vahvista-sahkoposti`, `LoginModal`, and the unverified banner. The submit button of each form is the lime button. The banner is a tint strip with ink text.
- [ ] **7.8 Listing form `/ilmoitukset/uusi` and `/ilmoitukset/$listingId/muokkaa`.** Category tiles with an ink ring on the selected one. Remove emoji. The image uploader gets the 10px radius and an ink "Kansikuva" pill. The submit button is lime. The form logic and validation do not change. `listing-form-validation.spec.ts` and the lifecycle specs must pass.
- [ ] **7.9 Bill of sale `/kauppakirja`.** Restyle only the screen UI (Tailwind classes with `print:hidden`). Do not change `styles/sale-contract.css`, the A4 document, the print rules, or the storage logic.
- [ ] **7.10 Static and error pages.** `/kayttoehdot`, `/tietosuoja`, the 404 component, the 500 component, and the per-route "not found" components.
- [ ] **7.11 Admin.** No layout work. Confirm that each admin page is legible with the new tokens.
- [ ] **7.12 Emails.** Confirm that the email wrapper from step 1.8 renders the new wordmark and colours. `email.spec.ts` must pass.

**Acceptance.**

- `grep -rnE "(bg|text|border|ring)-accent" apps/motori/src` returns nothing. Every usage is replaced by the rule under "Token mapping".
- Every form has at most one lime button.
- The full e2e suite passes.

---

## Phase 8: motion and cleanup

**Result.** The app has the motion from the prototype, and the temporary tokens are gone.

All motion is 150 to 300ms with an ease-out curve, uses `transform` and `opacity` where possible, and is off under `prefers-reduced-motion: reduce`. With reduced motion the final state shows at once. Copy the keyframes and timings from the prototype `styles.css`.

- [ ] **8.1 Reflector glint.** When a heart changes to saved, one diagonal light sweep crosses the lime circle (about 450ms, once). It does not play on page load for hearts that are already saved.
- [ ] **8.2 Photo opens into the page.** A click on a card navigates with a view transition in which the card photo and the gallery's first image share a `view-transition-name`. Browser Back plays it in reverse. Read the TanStack Router documentation for the installed version on `viewTransition` before you write code. Only the clicked card may carry the name at the moment of navigation, because two elements with the same name cancel the transition. Browsers without the API navigate as before.
- [ ] **8.3 Rolling total.** On the rental page, the total counts from the old value to the new value in about 350ms, in the summary and in the sticky bar. The `aria-live` region receives only the final value. The "Säästät" tag scales in once when it appears or changes.
- [ ] **8.4 Range sweep.** When the user picks the return day, the range band grows from the pickup day to the return day in at most 300ms. It does not replay on re-render, month change, or reload.
- [ ] **8.5 Feed rearrange.** When a filter, the sort, or the category changes, cards that stay move to their new places, cards that leave fade out, and new cards fade in (about 250ms). It must not delay input, and it must not queue: a new change cuts the running animation short.
- [ ] **8.6 Press feedback.** Cards, chips, pill buttons, tab bar items, and the heart scale to about 0.97 while pressed.
- [ ] **8.7 Cleanup.**
	- Delete the `accent` tokens from `theme.css`. Run the grep from Phase 7 across `apps` and `packages` and replace what remains, including in Talli.
	- Delete components, translation keys, images, and CSS that nothing uses now. Check `apps/motori/public/images/` for the old hero image sizes. Keep the images that the seed script uses.
	- Update `AGENTS.md` and `CLAUDE.md` (they have the same content): the "Project" line (Motori is a marketplace for motorcycle sales, rentals, gear, and parts), the "Conventions" line about colour tokens (name `reflector` and the rule that lime is never a text colour on a light surface), the fonts, and the map height note in the code if it still exists.
	- Delete `docs/prototypes/claude-redesign/` only if the product owner asks for it.
- [ ] **8.8 Full verification.** Run every check from "Rules for every phase", including `pnpm test:e2e:talli`. Then, in the production build, do this by hand at 390×844 and at 1280×800: browse, search, filter, save a search, open the map and go back, open a sale listing, send a message, open the bill of sale, book a rental as one user and confirm it as the owner, switch the language, and sign out. Record the result in the pull request.

**Acceptance.**

- With "reduce motion" on, no element animates.
- No console errors and no CSP violations in the production build.
- `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm test:e2e:talli` pass.
