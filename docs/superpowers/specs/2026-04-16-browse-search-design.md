# Browse + Search — Design Specification

## Overview

Step 4 of the MVP implementation plan. Adds a browse/search page (`/listings`), full-text search integration, filters, pagination, and updates the homepage from a placeholder to a proper landing page.

**Design direction**: Continues the "Nordic Moto Culture" editorial aesthetic established in the design system spec — Space Grotesk headings, DM Sans body, warm amber accents on deep navy, photography-forward cards. The goal is to feel like a premium platform people enjoy browsing, not a database with a UI.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Homepage vs browse | Separate pages | Homepage = landing + SEO, browse = focused filtering |
| Filter layout | Sidebar (desktop), drawer (mobile) | Sidebar chosen for always-visible filters; drawer on mobile |
| Pagination | "Load more" button | Cursor-based, simple, mobile-friendly, no scroll-position loss |
| Filter state | URL search params | Shareable, bookmarkable, SEO, TanStack Router support |
| Data fetching | Server-first (router loaders) | SSR, consistent with existing patterns, simpler than client-side |
| Grid density | 3 columns next to sidebar | Larger cards, photography-forward feel |
| Typography | Space Grotesk (headings) + DM Sans (body) | More distinctive than Inter alone, mechanical/modern feel |

---

## Pages

### Homepage (`/`)

**Purpose**: Communicate what Vuokramoto is, build trust, get users browsing within seconds.

**Layout (top to bottom):**

1. **Sticky nav** — transparent over hero, becomes frosted navy on scroll. Brand wordmark left ("vuokramoto" in Space Grotesk), links + amber CTA right.

2. **Split hero** (92vh) — two-column grid:
   - Left: seasonal tag pill ("Kausi 2026 on käynnissä" with pulsing amber dot), headline in Space Grotesk ("Vuokraa moottoripyörä *suoraan omistajalta*" — last line in amber), subtitle, search bar (glass-effect input + amber button), quick-filter chips (popular regions + types linking to `/listings?region=...`)
   - Right: full-bleed motorcycle hero image with left-edge gradient fade into navy. Frosted stats bar floating at bottom (listing count, regions, starting price).

3. **Seasonal strip** — full-width amber bar with contextual message. During riding season (Apr–Oct): "Kesäkausi on täällä — X pyörää odottaa sinua ympäri Suomea". Off-season: "Varaa ensi kaudelle — ilmoituksia lisätään jatkuvasti".

4. **Latest listings** — section header ("Uusimmat ilmoitukset" + "Selaa kaikkia →"), 3-column card grid showing 3–6 newest active listings using the elevated ListingCard.

5. **How it works** — dark navy section, 3 steps with oversized ghosted numbers (01/02/03), labels, descriptions, amber accent bars. Steps: Löydä pyörä → Ota yhteyttä → Lähde ajamaan.

6. **Lister CTA** — "Pyöräsi seisoo tallissa?" heading, subtitle about free listing, amber CTA button.

7. **Footer** — minimal, border-top separator, copyright + links + language toggle.

**Server function**: `getLatestListings` — fetches 6 most recent active listings with their first image, ordered by `created_at DESC`.

**Stats**: `getHomepageStats` — returns total active listing count, distinct region count, minimum price_per_day. These power the hero stats bar.

---

### Browse Page (`/listings`)

**Purpose**: Find the right bike. Powerful filtering without overwhelming the UI.

**URL structure**: `/listings?q=honda&region=uusimaa&type=naked&license=A2&price_min=30&price_max=100&sort=newest&cursor=...`

**Layout:**

#### Search Header
Dark navy strip below the nav. Contains:
- Search input (pre-filled from `q` param) + amber "Hae" button
- Context line below: "**24 ilmoitusta** haulle 'Honda' — Koko Suomi" (result count + active search/region summary)

#### Sidebar (desktop) / Drawer (mobile)
Sticky sidebar (260px), white background, scrollable.

**Filters:**
- **Alue** (Region) — select dropdown, "Koko Suomi" default
- **Tyyppi** (Motorcycle type) — 2-column grid of visual chips with emoji icons. Toggle on/off, multi-select. Active state: navy fill, white text.
  - ⚡ Naked, 🏎 Sport, 🧭 Touring, 🏔 Adventure, 🛣 Cruiser, 🌲 Enduro, 🏁 Motocross, 🛵 Skootteri
- **Ajokortti** (License class) — 3 chunky toggle buttons (A1, A2, A). Active: navy fill. Multi-select.
- **Hinta / päivä** (Price per day) — min/max text inputs with € placeholder
- **Järjestä** (Sort) — select dropdown: Uusimmat ensin, Hinta: halvin, Hinta: kallein, Osuvimmat (only when search query present)

**Active filter chips** — shown at sidebar bottom with × remove buttons. "Tyhjennä" (clear all) link in sidebar header.

**Mobile**: "Suodattimet" button with active count badge opens a slide-up drawer containing all filters + "Näytä X tulosta" amber button at bottom.

#### Results Area
- **Toolbar**: result count ("**24** ilmoitusta")
- **Card grid**: 3 columns, 18px gap
- **Load more**: "Näytä lisää · X jäljellä" button, hover turns amber with subtle lift
- **Loading state**: 3 skeleton cards with gentle opacity pulse (0.4–0.7, 1.8s cycle)

#### Empty State
When filters return 0 results:
- Search icon (dimmed), "Ei tuloksia näillä hakuehdoilla" heading
- "Kokeile laajentaa hakua tai poistaa suodattimia" description
- **Smart suggestion**: "💡 **12 pyörää** löytyi naapurimaakunnista" — counts listings in adjacent regions and shows the count if > 0
- Two buttons: "Laajenna hakua" (clears the region filter to search all of Finland) + "Tyhjennä suodattimet" (clears all filters and search query)

Adjacent region mapping for smart suggestions:
- Uusimaa → Päijät-Häme, Kanta-Häme, Kymenlaakso
- Pirkanmaa → Kanta-Häme, Satakunta, Keski-Suomi
- (etc. — defined in constants)

#### Low-Result Nudge
When results < 5: subtle banner below results "Vähän tuloksia? Kokeile laajentaa hakua tai lisää oma ilmoituksesi."

---

## ListingCard (Elevated)

Upgraded version of the existing ListingCard component.

**Structure:**
```
+─────────────────────────────+
│  [Uusi]              [♡]   │  ← badges overlay on image
│                             │
│     Motorcycle image        │  ← 16:10 aspect ratio
│     (hover: scale 1.04)     │
│                             │
│  ● ● ○ ○                   │  ← carousel dots (on hover)
│  ░░ 🪖 Kypärä  🛡 Vakuutus │  ← frosted trust bar
+─────────────────────────────+
│  Honda CB650R 2023     [A2] │  ← title + license badge
│  Naked · 649 cc             │  ← type + engine
│  ─────────────────────────  │
│  Helsinki, Uusimaa    65 €  │  ← location + price
│                        /pv  │
+─────────────────────────────+
```

**Enhancements over current ListingCard:**
- 16:10 image ratio (was 4:3) — more cinematic
- Frosted gradient overlay at image bottom with trust badges (helmet, insurance, photo count)
- "Uusi" amber badge on listings < 48h old
- Favorite heart button (white circle, top-right) with hover scale
- Carousel indicator dots appear on card hover (invisible by default)
- Card hover: translateY(-4px) + expanded shadow, spring easing (cubic-bezier 0.16, 1, 0.3, 1)
- Card image zooms to scale(1.04) on hover
- Price in Space Grotesk, amber, separated from location by a subtle border-top
- Footer section with border-top for visual separation

**Trust badges shown on image overlay:**
- 🪖 Kypärä — when `includes_helmet` is true
- 🛡 Vakuutus — when `includes_insurance` is true
- 📷 N — photo count when > 1

---

## Full-Text Search

**Existing infrastructure** (from migration 003):
- `search_vector` tsvector column with GIN index
- Finnish-language trigger: title=A weight, brand+model=B, description=C, city+region=D

**Search helper** (`src/lib/search.ts`):
```typescript
// Converts user query to tsquery
// - Splits on whitespace
// - Appends :* to each term for prefix matching
// - Joins with & (AND)
// Example: "honda hel" → "honda:* & hel:*"
function toTsQuery(query: string): string

// Builds the WHERE clause for FTS
// Uses ts_rank_cd for relevance scoring
```

**Relevance sort**: When `sort=relevance` (default when search query present), order by `ts_rank_cd(search_vector, query)` DESC, then `created_at` DESC as tiebreaker.

---

## Server Functions

### `searchListings`

**Input** (from URL search params):
```typescript
{
  q?: string           // free text search
  region?: string      // region value
  type?: string[]      // motorcycle types (multi-select)
  license?: string[]   // license classes (multi-select)
  price_min?: number   // EUR per day (not cents)
  price_max?: number   // EUR per day (not cents)
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'relevance'
  cursor?: string      // pagination cursor (created_at + id)
}
```

**Query building** (Kysely):
1. Base: `SELECT listing.*, listing_image.* FROM listing LEFT JOIN listing_image ON ...` where status = 'active'
2. If `q`: add `WHERE search_vector @@ to_tsquery('finnish', ...)` with prefix matching
3. If `region`: add `WHERE region = ?`
4. If `type`: add `WHERE motorcycle_type IN (?)`
5. If `license`: add `WHERE required_license IN (?)`
6. If `price_min`/`price_max`: add `WHERE price_per_day >= ? AND/OR price_per_day <= ?` (convert EUR to cents)
7. Sort: newest = `created_at DESC`, price_asc/desc = `price_per_day ASC/DESC`, relevance = `ts_rank_cd DESC`
8. Cursor: `WHERE (created_at, id) < (cursor_date, cursor_id)` for newest sort
9. Limit: 12 per page

**Output**:
```typescript
{
  listings: Array<Listing & { images: ListingImage[] }>
  nextCursor: string | null  // null = no more results
  totalCount: number         // for "X ilmoitusta" display
}
```

**Note on images**: Fetch only the first image per listing for the card grid (order = 0). Full image set is fetched on the detail page.

### `getNeighborRegionCount`

Called when main search returns 0 results. Takes the current region and returns total active listing count in adjacent regions. Used for the smart empty state suggestion.

---

## Pagination

**Cursor-based** using `(created_at, id)` composite cursor.

- Cursor is encoded as `${created_at_iso}__${id}` in the URL
- "Näytä lisää" button appends to existing results by navigating to same URL with cursor param added
- The route component accumulates pages client-side using React state initialized from the loader. When any filter or sort changes (not just cursor), accumulated pages reset and only the new first page is shown.
- When `nextCursor` is null, hide the load more button
- Load more button shows remaining count: totalCount - loadedCount

---

## Search Params Schema (Zod)

```typescript
const browseSearchSchema = z.object({
  q: z.string().optional(),
  region: z.string().optional(),
  type: z.array(z.string()).optional(),      // ?type=naked&type=sport
  license: z.array(z.string()).optional(),    // ?license=A2&license=A
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'relevance']).optional(),
  cursor: z.string().optional(),
})
```

TanStack Router's `validateSearch` option on the route definition handles parsing and validation.

---

## Mobile Adaptations

**Breakpoints:**
- Mobile: < 768px
- Tablet: 768–1024px
- Desktop: > 1024px

**Mobile browse page:**
- Sidebar hidden, replaced by "Suodattimet" button next to search
- Filter button shows active count badge (amber circle with number)
- Active filter chips shown as horizontal scrollable row below search
- Card grid: single column, cards use the same vertical layout (not horizontal)
- Filter drawer: slides up from bottom, contains all filter groups, "Näytä X tulosta" amber CTA at bottom

**Mobile homepage:**
- Hero becomes single column, image hidden, stats bar below the search area
- Quick-filter chips scroll horizontally
- Card grid: single column
- How-it-works: stacked vertically

**Tablet:**
- Browse grid: 2 columns
- Homepage cards: 2 columns
- Sidebar still visible at reduced width (220px)

---

## Fonts

**Addition to project**: Space Grotesk (headings) + DM Sans (body) replace Inter-only.

Load via Google Fonts with `font-display: swap`. Only load weights actually used:
- Space Grotesk: 600, 700
- DM Sans: 400, 500, 700

---

## New Files

| File | Purpose |
|------|---------|
| `src/routes/listings/index.tsx` | Browse page route with search params, loader, filter UI, card grid |
| `src/routes/index.tsx` | Homepage rewrite (hero, latest listings, how-it-works, CTA) |
| `src/lib/search.ts` | FTS query helpers (toTsQuery, relevance ranking) |
| `src/components/listings/filter-sidebar.tsx` | Sidebar filter panel (desktop) |
| `src/components/listings/filter-drawer.tsx` | Mobile slide-up filter drawer |
| `src/components/listings/listing-card.tsx` | Upgraded card (overwrite existing) |
| `src/components/listings/listing-card-skeleton.tsx` | Skeleton loading card |
| `src/components/listings/empty-state.tsx` | Smart empty/low-result state |
| `src/lib/constants.ts` | Add ADJACENT_REGIONS map, SORT_OPTIONS |

## Modified Files

| File | Changes |
|------|---------|
| `src/routes/__root.tsx` | Update nav to match new design (Space Grotesk brand, sticky, scroll effect) |
| `src/lib/validators.ts` | Add `browseSearchSchema` |
| `src/styles/app.css` | Add font imports, new color tokens, card animations |

---

## Out of Scope

- Quick Peek Modal (post-MVP)
- Finland map region picker (post-MVP)
- Interactive price histogram slider (post-MVP — use min/max inputs for now)
- Image carousel interaction on cards (dots shown but carousel not functional in MVP — just links to detail page)
- Favorites toggle functionality (heart shows on card but toggle is wired up in a later step)
