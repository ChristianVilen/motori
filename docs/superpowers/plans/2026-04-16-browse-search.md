# Browse + Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browse/search page (`/listings`) with full-text search, filters, cursor-based pagination, and replace the placeholder homepage with a proper landing page.

**Architecture:** Server-first data fetching via TanStack Router loaders. Kysely builds dynamic queries against PostgreSQL's existing FTS infrastructure (tsvector + GIN index from migration 003). Filter state lives in URL search params (Zod-validated). Cursor-based pagination with "load more" accumulates pages client-side.

**Tech Stack:** TanStack Start, TanStack Router (search params), Kysely, PostgreSQL FTS, Zod, Tailwind CSS v4, shadcn/ui, Space Grotesk + DM Sans (Google Fonts)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/styles/app.css` | Modify | Add font families, new tokens, card animation keyframes |
| `src/routes/__root.tsx` | Modify | Update Google Fonts link to load Space Grotesk + DM Sans, update nav |
| `src/lib/constants.ts` | Modify | Add `ADJACENT_REGIONS`, `SORT_OPTIONS`, `TYPE_EMOJI` maps |
| `src/lib/validators.ts` | Modify | Add `browseSearchSchema` for URL search params |
| `src/lib/search.ts` | Create | FTS query helpers (`toTsQuery`) |
| `src/lib/listings-queries.ts` | Create | `searchListings`, `getLatestListings`, `getHomepageStats`, `getNeighborRegionCount` server functions |
| `src/components/listings/listing-card.tsx` | Rewrite | Elevated card with 16:10 ratio, trust badges, hover effects |
| `src/components/listings/listing-card-skeleton.tsx` | Create | Skeleton loading card |
| `src/components/listings/filter-sidebar.tsx` | Create | Desktop sidebar filter panel |
| `src/components/listings/filter-drawer.tsx` | Create | Mobile slide-up filter drawer |
| `src/components/listings/empty-state.tsx` | Create | Smart empty + low-result states |
| `src/routes/listings/index.tsx` | Create | Browse page route with loader, filters, card grid, pagination |
| `src/routes/index.tsx` | Rewrite | Homepage with hero, search, latest listings, how-it-works, CTA |

---

### Task 1: Fonts + Design Tokens

**Files:**
- Modify: `src/styles/app.css`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Update Google Fonts in root**

In `src/routes/__root.tsx`, replace the Inter font link with Space Grotesk + DM Sans:

```tsx
// In the head() links array, replace the Inter stylesheet link with:
{
  rel: "stylesheet",
  href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap",
},
```

Also update the preconnect links to keep both `fonts.googleapis.com` and `fonts.gstatic.com` (already present).

- [ ] **Step 2: Update CSS tokens**

In `src/styles/app.css`, update the `@theme` block. Replace the existing `--font-sans` and add `--font-heading`:

```css
@theme {
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-heading: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;

  /* ...existing color tokens stay unchanged... */
}
```

After the `@theme` block, add card animation utilities:

```css
@utility card-hover {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@utility card-hover-active {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px -8px rgba(26, 26, 46, 0.18);
}
```

- [ ] **Step 3: Update body class in root**

In `src/routes/__root.tsx`, the body already uses `font-sans` which now maps to DM Sans. No change needed here — just verify.

- [ ] **Step 4: Commit**

```bash
git add src/styles/app.css src/routes/__root.tsx
git commit -m "feat: add Space Grotesk + DM Sans fonts and card animation tokens"
```

---

### Task 2: Constants + Validators

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add constants**

Append to the end of `src/lib/constants.ts`:

```typescript
export const ADJACENT_REGIONS: Record<string, string[]> = {
  uusimaa: ["paijat-hame", "kanta-hame", "kymenlaakso"],
  pirkanmaa: ["kanta-hame", "satakunta", "keski-suomi"],
  "varsinais-suomi": ["satakunta", "kanta-hame", "uusimaa"],
  "pohjois-pohjanmaa": ["kainuu", "keski-pohjanmaa", "lappi"],
  "keski-suomi": ["pirkanmaa", "pohjois-savo", "etela-pohjanmaa"],
  "pohjois-savo": ["keski-suomi", "pohjois-karjala", "etela-savo"],
  "paijat-hame": ["uusimaa", "kanta-hame", "keski-suomi"],
  satakunta: ["pirkanmaa", "varsinais-suomi", "pohjanmaa"],
  pohjanmaa: ["etela-pohjanmaa", "keski-pohjanmaa", "satakunta"],
  lappi: ["pohjois-pohjanmaa", "kainuu"],
  "etela-karjala": ["kymenlaakso", "etela-savo", "paijat-hame"],
  "etela-savo": ["pohjois-savo", "etela-karjala", "paijat-hame"],
  kainuu: ["pohjois-pohjanmaa", "pohjois-karjala", "lappi"],
  "keski-pohjanmaa": ["pohjanmaa", "pohjois-pohjanmaa", "etela-pohjanmaa"],
  kymenlaakso: ["uusimaa", "etela-karjala", "paijat-hame"],
  "pohjois-karjala": ["pohjois-savo", "kainuu", "etela-savo"],
  "etela-pohjanmaa": ["pohjanmaa", "keski-suomi", "pirkanmaa"],
  "kanta-hame": ["uusimaa", "pirkanmaa", "paijat-hame"],
  ahvenanmaa: ["varsinais-suomi"],
};

export const SORT_OPTIONS = [
  { value: "newest", label: "Uusimmat ensin" },
  { value: "price_asc", label: "Hinta: halvin" },
  { value: "price_desc", label: "Hinta: kallein" },
  { value: "relevance", label: "Osuvimmat" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const TYPE_EMOJI: Record<string, string> = {
  naked: "\u26A1",
  sport: "\uD83C\uDFCE",
  touring: "\uD83E\uDDED",
  adventure: "\uD83C\uDFD4",
  cruiser: "\uD83D\uDEE3",
  enduro: "\uD83C\uDF32",
  motocross: "\uD83C\uDFC1",
  scooter: "\uD83D\uDEF5",
  custom: "\uD83D\uDD27",
};
```

- [ ] **Step 2: Add browse search schema**

Append to `src/lib/validators.ts`:

```typescript
export const browseSearchSchema = z.object({
  q: z.string().optional(),
  region: z.string().optional(),
  type: z.array(z.string()).optional().default([]),
  license: z.array(z.string()).optional().default([]),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
  cursor: z.string().optional(),
});

export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts src/lib/validators.ts
git commit -m "feat: add adjacent regions, sort options, type emoji, browse search schema"
```

---

### Task 3: Full-Text Search Helper

**Files:**
- Create: `src/lib/search.ts`

- [ ] **Step 1: Create search helper**

Create `src/lib/search.ts`:

```typescript
/**
 * Converts a user search query into a PostgreSQL tsquery string.
 *
 * - Strips non-alphanumeric characters (keeping Finnish chars äöåÄÖÅ)
 * - Splits on whitespace
 * - Appends :* to each term for prefix matching
 * - Joins with & (AND)
 *
 * Example: "honda hel" → "honda:* & hel:*"
 * Example: "" → null (no search)
 */
export function toTsQuery(query: string): string | null {
  const terms = query
    .replace(/[^\w\s\u00C0-\u024F]/g, "")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return null;

  return terms.map((t) => `${t}:*`).join(" & ");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/search.ts
git commit -m "feat: add FTS query helper (toTsQuery with prefix matching)"
```

---

### Task 4: Server Functions (Data Layer)

**Files:**
- Create: `src/lib/listings-queries.ts`

This is the core data layer. All four server functions live here: `searchListings`, `getLatestListings`, `getHomepageStats`, `getNeighborRegionCount`.

- [ ] **Step 1: Create listings-queries.ts with searchListings**

Create `src/lib/listings-queries.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { ADJACENT_REGIONS } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { toTsQuery } from "~/lib/search";
import type { BrowseSearchParams } from "~/lib/validators";

const PAGE_SIZE = 12;

export type ListingWithImages = Listing & { images: ListingImage[] };

export interface SearchResult {
  listings: ListingWithImages[];
  nextCursor: string | null;
  totalCount: number;
}

export const searchListings = createServerFn({ method: "GET" })
  .inputValidator((input: BrowseSearchParams) => input)
  .handler(async ({ data: params }): Promise<SearchResult> => {
    const tsquery = params.q ? toTsQuery(params.q) : null;

    // --- Build the filtered base query ---
    let baseQuery = db
      .selectFrom("listing")
      .where("listing.status", "=", "active");

    if (tsquery) {
      baseQuery = baseQuery.where(
        sql`listing.search_vector @@ to_tsquery('finnish', ${tsquery})`,
      );
    }
    if (params.region) {
      baseQuery = baseQuery.where("listing.region", "=", params.region);
    }
    if (params.type && params.type.length > 0) {
      baseQuery = baseQuery.where(
        "listing.motorcycle_type",
        "in",
        params.type,
      );
    }
    if (params.license && params.license.length > 0) {
      baseQuery = baseQuery.where(
        "listing.required_license",
        "in",
        params.license,
      );
    }
    if (params.price_min != null) {
      baseQuery = baseQuery.where(
        "listing.price_per_day",
        ">=",
        params.price_min * 100,
      );
    }
    if (params.price_max != null) {
      baseQuery = baseQuery.where(
        "listing.price_per_day",
        "<=",
        params.price_max * 100,
      );
    }

    // --- Count total ---
    const countResult = await baseQuery
      .select(sql<number>`count(*)::int`.as("count"))
      .executeTakeFirstOrThrow();
    const totalCount = countResult.count;

    // --- Apply cursor ---
    let query = baseQuery.selectAll("listing");

    if (params.cursor) {
      const [cursorDate, cursorId] = params.cursor.split("__");
      if (cursorDate && cursorId) {
        const sort = params.sort ?? (tsquery ? "relevance" : "newest");
        if (sort === "price_asc") {
          // For price sort, cursor is price__id
          query = query.where((eb) =>
            eb.or([
              eb("listing.price_per_day", ">", Number(cursorDate)),
              eb.and([
                eb("listing.price_per_day", "=", Number(cursorDate)),
                eb("listing.id", ">", cursorId),
              ]),
            ]),
          );
        } else if (sort === "price_desc") {
          query = query.where((eb) =>
            eb.or([
              eb("listing.price_per_day", "<", Number(cursorDate)),
              eb.and([
                eb("listing.price_per_day", "=", Number(cursorDate)),
                eb("listing.id", "<", cursorId),
              ]),
            ]),
          );
        } else {
          // newest or relevance — cursor by created_at__id
          query = query.where((eb) =>
            eb.or([
              eb("listing.created_at", "<", new Date(cursorDate)),
              eb.and([
                eb("listing.created_at", "=", new Date(cursorDate)),
                eb("listing.id", "<", cursorId),
              ]),
            ]),
          );
        }
      }
    }

    // --- Sort ---
    const sort = params.sort ?? (tsquery ? "relevance" : "newest");
    if (sort === "relevance" && tsquery) {
      query = query
        .orderBy(
          sql`ts_rank_cd(listing.search_vector, to_tsquery('finnish', ${tsquery}))`,
          "desc",
        )
        .orderBy("listing.created_at", "desc");
    } else if (sort === "price_asc") {
      query = query
        .orderBy("listing.price_per_day", "asc")
        .orderBy("listing.id", "asc");
    } else if (sort === "price_desc") {
      query = query
        .orderBy("listing.price_per_day", "desc")
        .orderBy("listing.id", "desc");
    } else {
      // newest (default)
      query = query
        .orderBy("listing.created_at", "desc")
        .orderBy("listing.id", "desc");
    }

    query = query.limit(PAGE_SIZE);

    const listings = await query.execute();

    // --- Fetch first image per listing ---
    let images: ListingImage[] = [];
    if (listings.length > 0) {
      const listingIds = listings.map((l) => l.id);
      images = await db
        .selectFrom("listing_image")
        .selectAll()
        .where("listing_id", "in", listingIds)
        .where("order", "=", 0)
        .execute();
    }

    const imageMap = new Map<string, ListingImage[]>();
    for (const img of images) {
      const arr = imageMap.get(img.listing_id) ?? [];
      arr.push(img);
      imageMap.set(img.listing_id, arr);
    }

    const listingsWithImages: ListingWithImages[] = listings.map((l) => ({
      ...l,
      images: imageMap.get(l.id) ?? [],
    }));

    // --- Build next cursor ---
    let nextCursor: string | null = null;
    if (listings.length === PAGE_SIZE) {
      const last = listings[listings.length - 1];
      if (sort === "price_asc" || sort === "price_desc") {
        nextCursor = `${last.price_per_day}__${last.id}`;
      } else {
        nextCursor = `${new Date(last.created_at).toISOString()}__${last.id}`;
      }
    }

    return { listings: listingsWithImages, nextCursor, totalCount };
  });

export const getLatestListings = createServerFn({ method: "GET" }).handler(
  async () => {
    const listings = await db
      .selectFrom("listing")
      .selectAll()
      .where("status", "=", "active")
      .orderBy("created_at", "desc")
      .limit(6)
      .execute();

    if (listings.length === 0) return [];

    const listingIds = listings.map((l) => l.id);
    const images = await db
      .selectFrom("listing_image")
      .selectAll()
      .where("listing_id", "in", listingIds)
      .where("order", "=", 0)
      .execute();

    const imageMap = new Map<string, ListingImage[]>();
    for (const img of images) {
      const arr = imageMap.get(img.listing_id) ?? [];
      arr.push(img);
      imageMap.set(img.listing_id, arr);
    }

    return listings.map((l) => ({
      ...l,
      images: imageMap.get(l.id) ?? [],
    })) as ListingWithImages[];
  },
);

export const getHomepageStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const result = await db
      .selectFrom("listing")
      .select([
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(distinct region)::int`.as("regions"),
        sql<number>`coalesce(min(price_per_day), 0)::int`.as("min_price"),
      ])
      .where("status", "=", "active")
      .executeTakeFirstOrThrow();

    return {
      totalListings: result.total,
      regionCount: result.regions,
      minPricePerDay: Math.round(result.min_price / 100),
    };
  },
);

export const getNeighborRegionCount = createServerFn({ method: "GET" })
  .inputValidator((region: string) => region)
  .handler(async ({ data: region }) => {
    const neighbors = ADJACENT_REGIONS[region];
    if (!neighbors || neighbors.length === 0) return 0;

    const result = await db
      .selectFrom("listing")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("status", "=", "active")
      .where("region", "in", neighbors)
      .executeTakeFirstOrThrow();

    return result.count;
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/listings-queries.ts
git commit -m "feat: add searchListings, getLatestListings, getHomepageStats, getNeighborRegionCount server functions"
```

---

### Task 5: ListingCard (Elevated)

**Files:**
- Rewrite: `src/components/listings/listing-card.tsx`
- Create: `src/components/listings/listing-card-skeleton.tsx`

- [ ] **Step 1: Rewrite listing-card.tsx**

Replace the entire contents of `src/components/listings/listing-card.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { MOTORCYCLE_TYPES, REGIONS, TYPE_EMOJI } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";

interface ListingCardProps {
  listing: Listing;
  images: ListingImage[];
}

export function ListingCard({ listing, images }: ListingCardProps) {
  const firstImage = images[0];
  const regionLabel =
    REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
  const typeLabel =
    MOTORCYCLE_TYPES.find((t) => t.value === listing.motorcycle_type)?.label ??
    listing.motorcycle_type;
  const typeEmoji = TYPE_EMOJI[listing.motorcycle_type] ?? "";
  const priceEur = Math.round(listing.price_per_day / 100);

  const isNew =
    Date.now() - new Date(listing.created_at).getTime() < 48 * 60 * 60 * 1000;

  const imageCount = images.length;

  return (
    <Link
      to="/listings/$listingId"
      params={{ listingId: listing.id }}
      className="group block overflow-hidden rounded-xl border border-border bg-card card-hover hover:card-hover-active"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-muted-light">
        {firstImage ? (
          <img
            src={firstImage.url}
            alt={listing.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg
              className="h-12 w-12 text-border"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
              />
            </svg>
          </div>
        )}

        {/* Badges overlay */}
        {isNew && (
          <span className="absolute top-2.5 left-2.5 rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            Uusi
          </span>
        )}

        {/* Favorite button placeholder */}
        <button
          type="button"
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-muted transition-transform hover:scale-110"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Wired up in a later step
          }}
          aria-label="Lisaa suosikkeihin"
        >
          <Heart className="h-4 w-4" />
        </button>

        {/* Frosted trust bar at bottom of image */}
        <div className="absolute right-0 bottom-0 left-0 flex items-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent px-3 pt-6 pb-2.5">
          {listing.includes_helmet && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              Kypara
            </span>
          )}
          {listing.includes_insurance && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              Vakuutus
            </span>
          )}
          {imageCount > 1 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
              {imageCount}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground leading-tight">
            {listing.title}
          </h3>
          {listing.required_license && (
            <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
              {listing.required_license}
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-muted">
          {typeEmoji} {typeLabel}
          {listing.engine_cc ? ` \u00B7 ${listing.engine_cc} cc` : ""}
        </p>

        {/* Footer with border-top */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted">
            {listing.city}, {regionLabel}
          </span>
          <div className="text-right">
            <span className="font-heading text-lg font-bold text-accent">
              {priceEur} \u20AC
            </span>
            <span className="text-xs text-muted">/pv</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create listing-card-skeleton.tsx**

Create `src/components/listings/listing-card-skeleton.tsx`:

```tsx
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-[16/10] animate-pulse bg-muted-light" />
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted-light" />
          <div className="h-5 w-8 animate-pulse rounded bg-muted-light" />
        </div>
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted-light" />
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted-light" />
            <div className="h-5 w-16 animate-pulse rounded bg-muted-light" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/listings/listing-card.tsx src/components/listings/listing-card-skeleton.tsx
git commit -m "feat: elevated ListingCard with trust badges, 16:10 ratio, and skeleton loader"
```

---

### Task 6: Filter Sidebar + Drawer

**Files:**
- Create: `src/components/listings/filter-sidebar.tsx`
- Create: `src/components/listings/filter-drawer.tsx`

- [ ] **Step 1: Create filter-sidebar.tsx**

Create `src/components/listings/filter-sidebar.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  LICENSE_CLASSES,
  MOTORCYCLE_TYPES,
  REGIONS,
  SORT_OPTIONS,
  TYPE_EMOJI,
} from "~/lib/constants";
import type { BrowseSearchParams } from "~/lib/validators";

interface FilterSidebarProps {
  search: BrowseSearchParams;
  hasQuery: boolean;
}

export function FilterSidebar({ search, hasQuery }: FilterSidebarProps) {
  const navigate = useNavigate();

  function updateFilter(updates: Partial<BrowseSearchParams>) {
    navigate({
      to: "/listings",
      search: (prev) => ({
        ...prev,
        ...updates,
        cursor: undefined, // reset pagination on filter change
      }),
      replace: true,
    });
  }

  function toggleArrayFilter(
    key: "type" | "license",
    value: string,
  ) {
    const current = search[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter({ [key]: next.length > 0 ? next : undefined });
  }

  function clearAll() {
    navigate({
      to: "/listings",
      search: {},
      replace: true,
    });
  }

  const activeFilterCount =
    (search.region ? 1 : 0) +
    (search.type?.length ?? 0) +
    (search.license?.length ?? 0) +
    (search.price_min != null ? 1 : 0) +
    (search.price_max != null ? 1 : 0);

  return (
    <aside className="w-[260px] shrink-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-foreground">
          Suodattimet
        </h2>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-accent hover:underline"
          >
            Tyhjenna
          </button>
        )}
      </div>

      {/* Region */}
      <div>
        <label
          htmlFor="filter-region"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Alue
        </label>
        <select
          id="filter-region"
          value={search.region ?? ""}
          onChange={(e) =>
            updateFilter({
              region: e.target.value || undefined,
            })
          }
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Koko Suomi</option>
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Motorcycle type */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Tyyppi</p>
        <div className="grid grid-cols-2 gap-1.5">
          {MOTORCYCLE_TYPES.filter((t) => t.value !== "custom").map((t) => {
            const isActive = search.type?.includes(t.value);
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleArrayFilter("type", t.value)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-light text-foreground hover:bg-border"
                }`}
              >
                {TYPE_EMOJI[t.value]} {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* License class */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Ajokortti</p>
        <div className="flex gap-1.5">
          {LICENSE_CLASSES.map((l) => {
            const isActive = search.license?.includes(l.value);
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => toggleArrayFilter("license", l.value)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted-light text-foreground hover:bg-border"
                }`}
              >
                {l.value}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">
          Hinta / paiva
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min \u20AC"
            value={search.price_min ?? ""}
            onChange={(e) =>
              updateFilter({
                price_min: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <span className="text-muted">\u2013</span>
          <input
            type="number"
            placeholder="Max \u20AC"
            value={search.price_max ?? ""}
            onChange={(e) =>
              updateFilter({
                price_max: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <label
          htmlFor="filter-sort"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Jarjesta
        </label>
        <select
          id="filter-sort"
          value={search.sort ?? (hasQuery ? "relevance" : "newest")}
          onChange={(e) =>
            updateFilter({
              sort: e.target.value as BrowseSearchParams["sort"],
            })
          }
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {SORT_OPTIONS.filter(
            (s) => s.value !== "relevance" || hasQuery,
          ).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
          {search.region && (
            <FilterChip
              label={
                REGIONS.find((r) => r.value === search.region)?.label ??
                search.region
              }
              onRemove={() => updateFilter({ region: undefined })}
            />
          )}
          {search.type?.map((t) => (
            <FilterChip
              key={t}
              label={
                MOTORCYCLE_TYPES.find((mt) => mt.value === t)?.label ?? t
              }
              onRemove={() => toggleArrayFilter("type", t)}
            />
          ))}
          {search.license?.map((l) => (
            <FilterChip
              key={l}
              label={l}
              onRemove={() => toggleArrayFilter("license", l)}
            />
          ))}
          {search.price_min != null && (
            <FilterChip
              label={`Min ${search.price_min}\u20AC`}
              onRemove={() => updateFilter({ price_min: undefined })}
            />
          )}
          {search.price_max != null && (
            <FilterChip
              label={`Max ${search.price_max}\u20AC`}
              onRemove={() => updateFilter({ price_max: undefined })}
            />
          )}
        </div>
      )}
    </aside>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-1 text-xs text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted hover:text-foreground"
        aria-label={`Poista ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
```

- [ ] **Step 2: Create filter-drawer.tsx**

Create `src/components/listings/filter-drawer.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  LICENSE_CLASSES,
  MOTORCYCLE_TYPES,
  REGIONS,
  SORT_OPTIONS,
  TYPE_EMOJI,
} from "~/lib/constants";
import type { BrowseSearchParams } from "~/lib/validators";

interface FilterDrawerProps {
  search: BrowseSearchParams;
  hasQuery: boolean;
  totalCount: number;
  open: boolean;
  onClose: () => void;
}

export function FilterDrawer({
  search,
  hasQuery,
  totalCount,
  open,
  onClose,
}: FilterDrawerProps) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function updateFilter(updates: Partial<BrowseSearchParams>) {
    navigate({
      to: "/listings",
      search: (prev) => ({
        ...prev,
        ...updates,
        cursor: undefined,
      }),
      replace: true,
    });
  }

  function toggleArrayFilter(key: "type" | "license", value: string) {
    const current = search[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter({ [key]: next.length > 0 ? next : undefined });
  }

  function clearAll() {
    navigate({
      to: "/listings",
      search: {},
      replace: true,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={-1}
        aria-label="Sulje suodattimet"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background px-5 pt-4 pb-6"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Suodattimet
          </h2>
          <button type="button" onClick={onClose} aria-label="Sulje">
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Region */}
          <div>
            <label
              htmlFor="drawer-region"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Alue
            </label>
            <select
              id="drawer-region"
              value={search.region ?? ""}
              onChange={(e) =>
                updateFilter({ region: e.target.value || undefined })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Koko Suomi</option>
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Motorcycle type */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Tyyppi</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MOTORCYCLE_TYPES.filter((t) => t.value !== "custom").map(
                (t) => {
                  const isActive = search.type?.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleArrayFilter("type", t.value)}
                      className={`rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-light text-foreground hover:bg-border"
                      }`}
                    >
                      {TYPE_EMOJI[t.value]} {t.label}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* License class */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Ajokortti</p>
            <div className="flex gap-1.5">
              {LICENSE_CLASSES.map((l) => {
                const isActive = search.license?.includes(l.value);
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => toggleArrayFilter("license", l.value)}
                    className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-light text-foreground hover:bg-border"
                    }`}
                  >
                    {l.value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              Hinta / paiva
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min \u20AC"
                value={search.price_min ?? ""}
                onChange={(e) =>
                  updateFilter({
                    price_min: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
              <span className="text-muted">\u2013</span>
              <input
                type="number"
                placeholder="Max \u20AC"
                value={search.price_max ?? ""}
                onChange={(e) =>
                  updateFilter({
                    price_max: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>

          {/* Sort */}
          <div>
            <label
              htmlFor="drawer-sort"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Jarjesta
            </label>
            <select
              id="drawer-sort"
              value={search.sort ?? (hasQuery ? "relevance" : "newest")}
              onChange={(e) =>
                updateFilter({
                  sort: e.target.value as BrowseSearchParams["sort"],
                })
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {SORT_OPTIONS.filter(
                (s) => s.value !== "relevance" || hasQuery,
              ).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={clearAll}
            className="flex-1 rounded-lg border border-border py-3 text-sm font-medium text-foreground"
          >
            Tyhjenna
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-white"
          >
            Nayta {totalCount} tulosta
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/listings/filter-sidebar.tsx src/components/listings/filter-drawer.tsx
git commit -m "feat: add filter sidebar (desktop) and filter drawer (mobile)"
```

---

### Task 7: Empty State + Low Result Nudge

**Files:**
- Create: `src/components/listings/empty-state.tsx`

- [ ] **Step 1: Create empty-state.tsx**

Create `src/components/listings/empty-state.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getNeighborRegionCount } from "~/lib/listings-queries";
import type { BrowseSearchParams } from "~/lib/validators";

interface EmptyStateProps {
  search: BrowseSearchParams;
}

export function EmptyState({ search }: EmptyStateProps) {
  const navigate = useNavigate();
  const [neighborCount, setNeighborCount] = useState<number | null>(null);

  useEffect(() => {
    if (search.region) {
      getNeighborRegionCount({ data: search.region }).then(setNeighborCount);
    }
  }, [search.region]);

  function clearRegion() {
    navigate({
      to: "/listings",
      search: (prev) => ({ ...prev, region: undefined, cursor: undefined }),
      replace: true,
    });
  }

  function clearAll() {
    navigate({
      to: "/listings",
      search: {},
      replace: true,
    });
  }

  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Search className="mb-4 h-12 w-12 text-border" />
      <h3 className="font-heading text-lg font-semibold text-foreground">
        Ei tuloksia nailla hakuehdoilla
      </h3>
      <p className="mt-1 text-sm text-muted">
        Kokeile laajentaa hakua tai poistaa suodattimia
      </p>

      {search.region && neighborCount != null && neighborCount > 0 && (
        <p className="mt-4 text-sm text-foreground">
          <span className="font-semibold text-accent">{neighborCount} pyoraa</span>{" "}
          loytyi naapurimaakunnista
        </p>
      )}

      <div className="mt-6 flex gap-3">
        {search.region && (
          <button
            type="button"
            onClick={clearRegion}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted-light"
          >
            Laajenna hakua
          </button>
        )}
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Tyhjenna suodattimet
        </button>
      </div>
    </div>
  );
}

export function LowResultNudge() {
  return (
    <div className="mt-6 rounded-lg border border-border bg-muted-light px-4 py-3 text-center text-sm text-muted">
      Vahan tuloksia? Kokeile laajentaa hakua tai{" "}
      <a href="/listings/new" className="font-medium text-accent hover:underline">
        lisaa oma ilmoituksesi
      </a>
      .
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/listings/empty-state.tsx
git commit -m "feat: add smart empty state with neighbor region suggestion and low-result nudge"
```

---

### Task 8: Browse Page (`/listings`)

**Files:**
- Create: `src/routes/listings/index.tsx`

- [ ] **Step 1: Create the browse page route**

Create `src/routes/listings/index.tsx`:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { EmptyState, LowResultNudge } from "~/components/listings/empty-state";
import { FilterDrawer } from "~/components/listings/filter-drawer";
import { FilterSidebar } from "~/components/listings/filter-sidebar";
import { ListingCard } from "~/components/listings/listing-card";
import { ListingCardSkeleton } from "~/components/listings/listing-card-skeleton";
import { REGIONS } from "~/lib/constants";
import {
  searchListings,
  type ListingWithImages,
  type SearchResult,
} from "~/lib/listings-queries";
import { browseSearchSchema, type BrowseSearchParams } from "~/lib/validators";

export const Route = createFileRoute("/listings/")({
  validateSearch: (search) => browseSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchListings({ data: deps }),
  component: BrowsePage,
});

function BrowsePage() {
  const search = Route.useSearch();
  const initialData = Route.useLoaderData();
  const navigate = useNavigate();

  // Accumulate pages for "load more"
  const [pages, setPages] = useState<SearchResult[]>([initialData]);
  const prevSearchKey = useRef(searchKeyWithoutCursor(search));

  // Reset accumulated pages when filters change (not cursor)
  const currentKey = searchKeyWithoutCursor(search);
  if (currentKey !== prevSearchKey.current) {
    prevSearchKey.current = currentKey;
    setPages([initialData]);
  } else if (
    pages.length > 0 &&
    pages[pages.length - 1].nextCursor !== initialData.nextCursor &&
    search.cursor
  ) {
    // New page loaded via cursor — append it
    if (!pages.some((p) => p.nextCursor === initialData.nextCursor)) {
      setPages((prev) => [...prev, initialData]);
    }
  }

  const allListings = pages.flatMap((p) => p.listings);
  const totalCount = pages[0].totalCount;
  const lastPage = pages[pages.length - 1];
  const nextCursor = lastPage.nextCursor;
  const remaining = totalCount - allListings.length;

  const hasQuery = !!search.q && search.q.trim().length > 0;
  const regionLabel = search.region
    ? (REGIONS.find((r) => r.value === search.region)?.label ?? search.region)
    : "Koko Suomi";

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeFilterCount =
    (search.region ? 1 : 0) +
    (search.type?.length ?? 0) +
    (search.license?.length ?? 0) +
    (search.price_min != null ? 1 : 0) +
    (search.price_max != null ? 1 : 0);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    navigate({
      to: "/listings",
      search: (prev) => ({ ...prev, cursor: nextCursor }),
      replace: true,
    });
    setLoadingMore(false);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string)?.trim() || undefined;
    navigate({
      to: "/listings",
      search: (prev) => ({ ...prev, q, cursor: undefined }),
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav placeholder — uses the root layout nav */}

      {/* Search header */}
      <div className="bg-primary px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              name="q"
              type="text"
              defaultValue={search.q ?? ""}
              placeholder="Hae merkkia, mallia, kaupunkia..."
              className="h-11 flex-1 rounded-lg bg-white/10 px-4 text-sm text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Hae
            </button>
            {/* Mobile filter button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative h-11 rounded-lg bg-white/10 px-3 text-white lg:hidden"
              aria-label="Suodattimet"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </form>
          <p className="mt-2 text-sm text-white/60">
            <span className="font-semibold text-white">{totalCount}</span>{" "}
            ilmoitusta
            {hasQuery && (
              <>
                {" "}
                haulle &lsquo;{search.q}&rsquo;
              </>
            )}
            {" \u2014 "}
            {regionLabel}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <FilterSidebar search={search} hasQuery={hasQuery} />
          </div>
        </div>

        {/* Results area */}
        <div className="min-w-0 flex-1">
          {allListings.length === 0 ? (
            <EmptyState search={search} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    images={listing.images}
                  />
                ))}
                {loadingMore &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <ListingCardSkeleton key={`skel-${i}`} />
                  ))}
              </div>

              {totalCount > 0 && totalCount <= 5 && <LowResultNudge />}

              {nextCursor && remaining > 0 && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Nayta lisaa \u00B7 {remaining} jaljella
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <FilterDrawer
        search={search}
        hasQuery={hasQuery}
        totalCount={totalCount}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}

function searchKeyWithoutCursor(search: BrowseSearchParams): string {
  const { cursor, ...rest } = search;
  return JSON.stringify(rest);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/listings/index.tsx
git commit -m "feat: add browse page with search, filters, pagination, and responsive layout"
```

---

### Task 9: Homepage Rewrite

**Files:**
- Rewrite: `src/routes/index.tsx`

The homepage follows the "Nordic Moto Culture" editorial design from the spec: split hero with Space Grotesk headings, search bar, stats, seasonal strip, latest listings grid, how-it-works section, and lister CTA. Hero image area uses a placeholder that can be swapped with real images later.

- [ ] **Step 1: Rewrite index.tsx**

Replace the entire contents of `src/routes/index.tsx`:

```tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  getHomepageStats,
  getLatestListings,
} from "~/lib/listings-queries";
import { ListingCard } from "~/components/listings/listing-card";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [latestListings, stats] = await Promise.all([
      getLatestListings(),
      getHomepageStats(),
    ]);
    return { latestListings, stats };
  },
  component: HomePage,
});

function HomePage() {
  const { latestListings, stats } = Route.useLoaderData();
  const navigate = useNavigate();

  const isRidingSeason = (() => {
    const month = new Date().getMonth(); // 0-indexed
    return month >= 3 && month <= 9; // April (3) through October (9)
  })();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string)?.trim() || undefined;
    navigate({
      to: "/listings",
      search: q ? { q } : {},
    });
  }

  return (
    <div className="min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-primary">
        <div className="mx-auto grid min-h-[92vh] max-w-7xl lg:grid-cols-2">
          {/* Left column */}
          <div className="flex flex-col justify-center px-6 py-16 lg:px-12 lg:py-24">
            {/* Seasonal tag */}
            {isRidingSeason && (
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="text-sm text-white/70">
                  Kausi 2026 on kaynnissa
                </span>
              </div>
            )}

            <h1 className="font-heading text-4xl leading-[1.1] font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Vuokraa moottoripyora{" "}
              <span className="text-accent">suoraan omistajalta</span>
            </h1>

            <p className="mt-4 max-w-md text-lg text-white/60">
              Suomen suurin vertaisvuokrauspalvelu moottoripyorille. Loyda
              unelmiesi pyora tai tienaa omallasi.
            </p>

            {/* Search bar */}
            <form
              onSubmit={handleSearch}
              className="mt-8 flex max-w-lg gap-2"
            >
              <input
                name="q"
                type="text"
                placeholder="Hae merkkia, mallia, kaupunkia..."
                className="h-12 flex-1 rounded-lg bg-white/10 px-4 text-white placeholder:text-white/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="submit"
                className="h-12 rounded-lg bg-accent px-6 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
              >
                Hae
              </button>
            </form>

            {/* Quick filter chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Uusimaa", search: { region: "uusimaa" } },
                { label: "Pirkanmaa", search: { region: "pirkanmaa" } },
                { label: "Naked", search: { type: ["naked"] } },
                { label: "A2-kortti", search: { license: ["A2"] } },
                { label: "Touring", search: { type: ["touring"] } },
              ].map((chip) => (
                <Link
                  key={chip.label}
                  to="/listings"
                  search={chip.search}
                  className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {chip.label}
                </Link>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-10 flex gap-8">
              <div>
                <p className="font-heading text-2xl font-bold text-accent">
                  {stats.totalListings}
                </p>
                <p className="text-xs tracking-wide text-white/40 uppercase">
                  ilmoitusta
                </p>
              </div>
              <div>
                <p className="font-heading text-2xl font-bold text-accent">
                  {stats.regionCount}
                </p>
                <p className="text-xs tracking-wide text-white/40 uppercase">
                  aluetta
                </p>
              </div>
              {stats.minPricePerDay > 0 && (
                <div>
                  <p className="font-heading text-2xl font-bold text-accent">
                    {stats.minPricePerDay} \u20AC
                  </p>
                  <p className="text-xs tracking-wide text-white/40 uppercase">
                    alk. / paiva
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right column — hero image placeholder */}
          <div className="relative hidden lg:block">
            {/* Gradient fade from left (over image) into navy background */}
            <div className="absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-primary to-transparent" />

            {/*
              HERO IMAGE PLACEHOLDER
              Replace this div with an <img> or background image.
              The user has 3-4 hero images to slot in.
              Options: single image, or a subtle crossfade/slideshow.
            */}
            <div className="h-full w-full bg-gradient-to-br from-primary via-primary/80 to-accent/20" />
          </div>
        </div>
      </section>

      {/* ─── Seasonal strip ─── */}
      <div className="bg-gradient-to-r from-accent to-accent-hover px-4 py-3 text-center text-sm font-medium text-white">
        {isRidingSeason
          ? `Kesakausi on taalla \u2014 ${stats.totalListings} pyoraa odottaa sinua ympari Suomea`
          : "Varaa ensi kaudelle \u2014 ilmoituksia lisataan jatkuvasti"}
      </div>

      {/* ─── Latest listings ─── */}
      {latestListings.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                Uusimmat ilmoitukset
              </h2>
              <p className="mt-1 text-sm text-muted">
                Tuoreimmat lisaykset
              </p>
            </div>
            <Link
              to="/listings"
              search={{ sort: "newest" }}
              className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              Selaa kaikkia
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {latestListings.slice(0, 6).map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                images={listing.images}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── How it works ─── */}
      <section className="bg-primary px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center font-heading text-2xl font-bold text-white">
            Nain se toimii
          </h2>

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Loyda pyora",
                desc: "Selaa ilmoituksia alueittain, tyypeittain tai hae vapaalla haulla.",
              },
              {
                num: "02",
                title: "Ota yhteytta",
                desc: "Sovi vuokrauksen yksityiskohdat suoraan omistajan kanssa.",
              },
              {
                num: "03",
                title: "Lahde ajamaan",
                desc: "Nouda pyora, nauti matkasta ja palauta sovitusti.",
              },
            ].map((step) => (
              <div key={step.num} className="relative pl-16">
                <span className="absolute top-0 left-0 font-heading text-5xl font-bold text-white/5">
                  {step.num}
                </span>
                <div className="mb-2 h-1 w-8 rounded-full bg-accent" />
                <h3 className="font-heading text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-white/50">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Lister CTA ─── */}
      <section className="px-4 py-16 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Pyorasi seisoo tallissa?
        </h2>
        <p className="mt-2 text-muted">
          Ilmoittaminen on ilmaista. Tavoita tuhansia moottoripyorailysta
          kiinnostuneita.
        </p>
        <Link
          to="/listings/new"
          className="mt-6 inline-block rounded-lg bg-accent px-8 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Lisaa ilmoitus
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-heading text-sm font-semibold text-foreground">
            vuokramoto
          </p>
          <div className="flex gap-6 text-xs text-muted">
            <Link to="/listings" className="hover:text-foreground">
              Selaa ilmoituksia
            </Link>
            <Link to="/listings/new" className="hover:text-foreground">
              Ilmoita pyora
            </Link>
          </div>
          <p className="text-xs text-muted">
            \u00A9 {new Date().getFullYear()} Vuokramoto
          </p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: rewrite homepage with hero, search, latest listings, how-it-works, CTA"
```

---

### Task 10: Nav Update

**Files:**
- Modify: `src/routes/__root.tsx`

Update the root layout nav to match the new design — Space Grotesk brand wordmark, proper nav links.

- [ ] **Step 1: Update __root.tsx nav**

Replace the `RootComponent` and `RootDocument` functions in `src/routes/__root.tsx`:

```tsx
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Vuokramoto \u2014 Vuokraa moottoripyora" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fi">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <nav className="border-b border-border bg-primary px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link
              to="/"
              className="font-heading text-lg font-bold text-white"
            >
              vuokramoto
            </Link>
            <div className="flex items-center gap-6">
              <Link
                to="/listings"
                className="text-sm text-white/70 hover:text-white"
              >
                Selaa
              </Link>
              <Link
                to="/listings/new"
                className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Ilmoita pyora
              </Link>
            </div>
          </div>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat: update root nav with Space Grotesk brand wordmark and browse/CTA links"
```

---

### Task 11: Verify + Fix TypeScript

**Files:** (any files from previous tasks that need type fixes)

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: some type errors may surface from Kysely's `sql` template literals or from the new search params types. Fix any errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint:fix
```

Expected: Biome auto-fixes formatting issues. Review any remaining lint errors and fix manually.

- [ ] **Step 3: Run dev server and test**

```bash
pnpm dev
```

Test in browser:
1. Visit `/` — verify hero, search bar, stats, latest listings, how-it-works, CTA, footer
2. Use the hero search bar — should navigate to `/listings?q=...`
3. Visit `/listings` — verify search header, sidebar filters (desktop), card grid
4. Apply filters (region, type, license, price) — verify URL updates, results filter
5. Click "Nayta lisaa" — verify pagination loads more results
6. Resize to mobile — verify sidebar hidden, filter button shows, drawer opens
7. Visit `/listings` with no results — verify empty state renders

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint errors from browse + search implementation"
```

---

## Spec Coverage Verification

| Spec Section | Task(s) |
|---|---|
| Fonts (Space Grotesk + DM Sans) | Task 1 |
| Constants (ADJACENT_REGIONS, SORT_OPTIONS, TYPE_EMOJI) | Task 2 |
| Search params schema (browseSearchSchema) | Task 2 |
| FTS helper (toTsQuery) | Task 3 |
| searchListings server function | Task 4 |
| getLatestListings server function | Task 4 |
| getHomepageStats server function | Task 4 |
| getNeighborRegionCount server function | Task 4 |
| ListingCard (elevated) | Task 5 |
| ListingCardSkeleton | Task 5 |
| Filter sidebar (desktop) | Task 6 |
| Filter drawer (mobile) | Task 6 |
| Empty state + low-result nudge | Task 7 |
| Browse page (/listings) with all features | Task 8 |
| Homepage rewrite (/) | Task 9 |
| Nav update (root layout) | Task 10 |
| TypeScript + lint + manual test | Task 11 |
| Hero image placeholder for 3-4 images | Task 9 (placeholder div with comment) |
