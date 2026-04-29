# Listing Slug URLs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace UUID listing URLs (`/ilmoitukset/<uuid>`) with short ID + decorative slug URLs (`/ilmoitukset/<shortId>/<make-model-city>`).

**Architecture:** A new `short_id varchar(8)` column (Base62, generated at insert) is added to `listing`. A `slugify` utility transliterates Finnish chars and normalises text; `computeListingSlug` builds the decorative slug from make slug + model name + city. The detail route is renamed to a flat two-segment TanStack file `$listingId_.$slug.tsx` — only `$listingId` (the `short_id`) is used for DB lookup; `$slug` is ignored. All link call-sites are updated to pass both params.

**Tech Stack:** Kysely migrations, TanStack Start file-based routing, Vitest unit tests, Playwright e2e.

---

## File map

| Action | Path |
|--------|------|
| Create | `src/lib/slug.ts` |
| Create | `src/lib/slug.test.ts` |
| Create | `src/lib/db/migrations/015_listing_short_id.ts` |
| Create | `src/routes/ilmoitukset/$listingId_.$slug.tsx` |
| Delete | `src/routes/ilmoitukset/$listingId.tsx` |
| Modify | `src/lib/db/schema.ts` |
| Modify | `src/lib/db/seed.ts` |
| Modify | `src/lib/listings-queries.ts` |
| Modify | `src/components/listings/listing-card.tsx` |
| Modify | `src/routes/ilmoitukset/uusi.tsx` |
| Modify | `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` |
| Modify | `src/routes/omat/index.tsx` |
| Modify | `src/routes/profiili/$userId.tsx` |
| Modify | `src/routes/sitemap[.]xml.ts` |
| Modify | `src/lib/reports.ts` |
| Modify | `src/routes/admin/moderation.tsx` |
| Modify | `e2e/global-setup.ts` |
| Modify | `e2e/pages/listing-detail.page.ts` |
| Modify | `e2e/tests/listings.spec.ts` |
| Modify | `e2e/tests/listing-lifecycle.spec.ts` |

---

## Task 1: slug utilities (TDD)

**Files:**
- Create: `src/lib/slug.ts`
- Create: `src/lib/slug.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeListingSlug, generateShortId, slugify } from "./slug";

describe("slugify", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("transliterates Finnish characters", () => {
		expect(slugify("Hämeenlinna")).toBe("hameenlinna");
		expect(slugify("Jyväskylä")).toBe("jyvaskyla");
		expect(slugify("Öölöö")).toBe("ooloo");
		expect(slugify("Åbo")).toBe("abo");
	});

	it("strips non-alphanumeric characters", () => {
		expect(slugify("CB500F!")).toBe("cb500f");
	});

	it("collapses multiple separators into one hyphen", () => {
		expect(slugify("foo   bar")).toBe("foo-bar");
		expect(slugify("foo---bar")).toBe("foo-bar");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-foo-")).toBe("foo");
	});
});

describe("computeListingSlug", () => {
	it("combines make slug, slugified model name, and slugified city", () => {
		expect(computeListingSlug("kawasaki", "Z650", "Helsinki")).toBe("kawasaki-z650-helsinki");
	});

	it("omits model segment when model is null", () => {
		expect(computeListingSlug("honda", null, "Tampere")).toBe("honda-tampere");
	});

	it("slugifies city and model name", () => {
		expect(computeListingSlug("yamaha", "MT-07", "Hämeenlinna")).toBe(
			"yamaha-mt-07-hameenlinna",
		);
	});

	it("handles null make slug gracefully", () => {
		expect(computeListingSlug(null, null, "Helsinki")).toBe("helsinki");
	});
});

describe("generateShortId", () => {
	it("returns exactly 8 characters", () => {
		expect(generateShortId()).toHaveLength(8);
	});

	it("contains only base62 characters", () => {
		for (let i = 0; i < 20; i++) {
			expect(generateShortId()).toMatch(/^[0-9A-Za-z]{8}$/);
		}
	});

	it("produces different values each call", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateShortId()));
		expect(ids.size).toBe(100);
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/cride/workspace/vuokramoto && pnpm vitest run src/lib/slug.test.ts
```

Expected: FAIL — `Cannot find module './slug'`

- [ ] **Step 3: Implement `src/lib/slug.ts`**

```ts
import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateShortId(): string {
	const bytes = randomBytes(8);
	let result = "";
	for (const byte of bytes) {
		result += BASE62[byte % 62];
	}
	return result;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[äå]/g, "a")
		.replace(/ö/g, "o")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function computeListingSlug(
	makeSlug: string | null,
	modelName: string | null,
	city: string,
): string {
	const parts = [makeSlug, modelName ? slugify(modelName) : null, slugify(city)].filter(
		(p): p is string => !!p,
	);
	return parts.join("-");
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/cride/workspace/vuokramoto && pnpm vitest run src/lib/slug.test.ts
```

Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/lib/slug.ts src/lib/slug.test.ts && git commit -m "feat: slug utilities — generateShortId, slugify, computeListingSlug"
```

---

## Task 2: DB migration and schema

**Files:**
- Create: `src/lib/db/migrations/015_listing_short_id.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Create migration**

Create `src/lib/db/migrations/015_listing_short_id.ts`:

```ts
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing ADD COLUMN short_id varchar(8)`.execute(db);
	// Backfill existing rows (dev/e2e only — prod has no rows at this point)
	await sql`UPDATE listing SET short_id = substr(md5(id::text), 1, 8) WHERE short_id IS NULL`.execute(db);
	await sql`ALTER TABLE listing ALTER COLUMN short_id SET NOT NULL`.execute(db);
	await sql`ALTER TABLE listing ADD CONSTRAINT listing_short_id_unique UNIQUE (short_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing DROP COLUMN short_id`.execute(db);
}
```

- [ ] **Step 2: Run migration**

```bash
cd /home/cride/workspace/vuokramoto && pnpm db:migrate
```

Expected: `Migrated: 015_listing_short_id`

- [ ] **Step 3: Update schema.ts**

In `src/lib/db/schema.ts`, add `short_id` to `ListingTable` after `owner_id`:

```ts
export interface ListingTable {
	id: string;
	owner_id: string;
	short_id: string;
	title: string;
	// ... rest unchanged
```

- [ ] **Step 4: Regenerate DB types**

```bash
cd /home/cride/workspace/vuokramoto && pnpm db:codegen
```

- [ ] **Step 5: Typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck
```

Expected: PASS (only new errors would be places that construct `NewListing` without `short_id` — those are fixed in later tasks)

- [ ] **Step 6: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/lib/db/migrations/015_listing_short_id.ts src/lib/db/schema.ts src/lib/db/schema.generated.ts && git commit -m "feat: add short_id column to listing table"
```

---

## Task 3: listings-queries — attach make/model, extend ListingWithImages

**Files:**
- Modify: `src/lib/listings-queries.ts`

`searchListings` and `getLatestListings` both do `selectAll("listing")` without joining make/model. Add an `attachMakeModel` helper to batch-fetch make slugs and model names after the main query, extending results without restructuring the complex query builder.

- [ ] **Step 1: Update `src/lib/listings-queries.ts`**

Replace the entire file:

```ts
import { createServerFn } from "@tanstack/react-start";
import { type SelectQueryBuilder, type SqlBool, sql } from "kysely";
import { ADJACENT_REGIONS } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Database, Listing, ListingImage } from "~/lib/db/schema";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toTsQuery } from "~/lib/search";
import type { BrowseSearchParams } from "~/lib/validators";

const PAGE_SIZE = 12;

type SortMode = "relevance" | "price_asc" | "price_desc" | "newest";

export type ListingWithImages = Listing & {
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
};

export interface SearchResult {
	listings: ListingWithImages[];
	nextCursor: string | null;
	totalCount: number;
}

type ListingQuery<O> = SelectQueryBuilder<Database, "listing", O>;

function applyCursor<O>(query: ListingQuery<O>, cursor: string, sort: SortMode): ListingQuery<O> {
	const [cursorVal, cursorId] = cursor.split("__");
	if (!cursorVal || !cursorId) {
		return query;
	}

	if (sort === "price_asc") {
		return query.where((eb) =>
			eb.or([
				eb("listing.price_per_day", ">", Number(cursorVal)),
				eb.and([
					eb("listing.price_per_day", "=", Number(cursorVal)),
					eb("listing.id", ">", cursorId),
				]),
			]),
		);
	}
	if (sort === "price_desc") {
		return query.where((eb) =>
			eb.or([
				eb("listing.price_per_day", "<", Number(cursorVal)),
				eb.and([
					eb("listing.price_per_day", "=", Number(cursorVal)),
					eb("listing.id", "<", cursorId),
				]),
			]),
		);
	}
	return query.where((eb) =>
		eb.or([
			eb("listing.created_at", "<", new Date(cursorVal)),
			eb.and([eb("listing.created_at", "=", new Date(cursorVal)), eb("listing.id", "<", cursorId)]),
		]),
	);
}

function applySort<O>(
	query: ListingQuery<O>,
	sort: SortMode,
	tsquery: string | null,
): ListingQuery<O> {
	if (sort === "relevance" && tsquery) {
		return query
			.orderBy(
				sql`ts_rank_cd(listing.search_vector, websearch_to_tsquery('finnish_unaccent', ${tsquery}))`,
				"desc",
			)
			.orderBy("listing.created_at", "desc");
	}
	if (sort === "price_asc") {
		return query.orderBy("listing.price_per_day", "asc").orderBy("listing.id", "asc");
	}
	if (sort === "price_desc") {
		return query.orderBy("listing.price_per_day", "desc").orderBy("listing.id", "desc");
	}
	return query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
}

async function fetchFirstImages(listingIds: string[]): Promise<Map<string, ListingImage[]>> {
	const imageMap = new Map<string, ListingImage[]>();
	if (listingIds.length === 0) {
		return imageMap;
	}

	const images = await db
		.selectFrom("listing_image")
		.selectAll()
		.where("listing_id", "in", listingIds)
		.where("order", "=", 0)
		.execute();

	for (const img of images) {
		const arr = imageMap.get(img.listing_id) ?? [];
		arr.push(img);
		imageMap.set(img.listing_id, arr);
	}
	return imageMap;
}

async function attachMakeModel<T extends Listing>(
	listings: T[],
): Promise<Array<T & { makeSlug: string | null; modelName: string | null }>> {
	if (listings.length === 0) {
		return [];
	}

	const makeIds = [...new Set(listings.map((l) => l.make_id))];
	const modelIds = [
		...new Set(listings.map((l) => l.model_id).filter((id): id is string => id !== null)),
	];

	const [makes, models] = await Promise.all([
		db.selectFrom("motorcycle_make").select(["id", "slug"]).where("id", "in", makeIds).execute(),
		modelIds.length > 0
			? db
					.selectFrom("motorcycle_model")
					.select(["id", "name"])
					.where("id", "in", modelIds)
					.execute()
			: Promise.resolve([]),
	]);

	const makeMap = new Map(makes.map((m) => [m.id, m.slug]));
	const modelMap = new Map(models.map((m) => [m.id, m.name]));

	return listings.map((l) => ({
		...l,
		makeSlug: makeMap.get(l.make_id) ?? null,
		modelName: l.model_id ? (modelMap.get(l.model_id) ?? null) : null,
	}));
}

// NOTE: For "relevance" sort, the cursor falls back to created_at which may skip
// results with lower relevance but newer timestamps. Acceptable for MVP since most
// users won't page deep through relevance results. A proper fix would require
// encoding the rank score into the cursor or using offset-based pagination for relevance.
function buildNextCursor(listings: Listing[], sort: SortMode): string | null {
	if (listings.length < PAGE_SIZE) {
		return null;
	}
	const last = listings[listings.length - 1];
	if (sort === "price_asc" || sort === "price_desc") {
		return `${last.price_per_day}__${last.id}`;
	}
	return `${new Date(last.created_at).toISOString()}__${last.id}`;
}

export const searchListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "search")])
	.inputValidator((input: BrowseSearchParams) => input)
	.handler(async ({ data: params }): Promise<SearchResult> => {
		const tsquery = params.q ? toTsQuery(params.q) : null;
		const sort: SortMode = params.sort ?? (tsquery ? "relevance" : "newest");

		let baseQuery = db.selectFrom("listing").where("listing.status", "=", "active");

		if (tsquery) {
			baseQuery = baseQuery.where(
				sql<SqlBool>`listing.search_vector @@ websearch_to_tsquery('finnish_unaccent', ${tsquery})`,
			);
		}
		if (params.region) {
			baseQuery = baseQuery.where("listing.region", "=", params.region);
		}
		if (params.type && params.type.length > 0) {
			baseQuery = baseQuery.where("listing.motorcycle_type", "in", params.type);
		}
		if (params.license && params.license.length > 0) {
			baseQuery = baseQuery.where(
				"listing.required_license",
				"in",
				params.license as ("A1" | "A2" | "A")[],
			);
		}
		if (params.price_min != null) {
			baseQuery = baseQuery.where("listing.price_per_day", ">=", params.price_min * 100);
		}
		if (params.price_max != null) {
			baseQuery = baseQuery.where("listing.price_per_day", "<=", params.price_max * 100);
		}

		const countResult = await baseQuery
			.select(sql<number>`count(*)::int`.as("count"))
			.executeTakeFirstOrThrow();

		let query = baseQuery.selectAll("listing");
		if (params.cursor) {
			query = applyCursor(query, params.cursor, sort);
		}
		query = applySort(query, sort, tsquery);
		query = query.limit(PAGE_SIZE);

		const listings = await query.execute();

		const [withMakeModel, imageMap] = await Promise.all([
			attachMakeModel(listings),
			fetchFirstImages(listings.map((l) => l.id)),
		]);

		const listingsWithImages: ListingWithImages[] = withMakeModel.map((l) => ({
			...l,
			images: imageMap.get(l.id) ?? [],
		}));

		return {
			listings: listingsWithImages,
			nextCursor: buildNextCursor(listings, sort),
			totalCount: countResult.count,
		};
	});

export const getLatestListings = createServerFn({ method: "GET" }).handler(async () => {
	const listings = await db
		.selectFrom("listing")
		.selectAll()
		.where("status", "=", "active")
		.orderBy("created_at", "desc")
		.limit(6)
		.execute();

	if (listings.length === 0) {
		return [] as ListingWithImages[];
	}

	const [withMakeModel, imageMap] = await Promise.all([
		attachMakeModel(listings),
		fetchFirstImages(listings.map((l) => l.id)),
	]);

	return withMakeModel.map((l) => ({
		...l,
		images: imageMap.get(l.id) ?? [],
	})) as ListingWithImages[];
});

export const getHomepageStats = createServerFn({ method: "GET" }).handler(async () => {
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
});

export const getNeighborRegionCount = createServerFn({ method: "GET" })
	.inputValidator((region: string) => {
		if (!(region in ADJACENT_REGIONS)) {
			throw new Error("Unknown region");
		}
		return region;
	})
	.handler(async ({ data: region }) => {
		const neighbors = ADJACENT_REGIONS[region];
		if (!neighbors || neighbors.length === 0) {
			return 0;
		}

		const result = await db
			.selectFrom("listing")
			.select(sql<number>`count(*)::int`.as("count"))
			.where("status", "=", "active")
			.where("region", "in", neighbors)
			.executeTakeFirstOrThrow();

		return result.count;
	});
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck 2>&1 | head -40
```

Expected: errors only in call sites that haven't been updated yet (listing-card, routes).

- [ ] **Step 3: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/lib/listings-queries.ts && git commit -m "feat: attach makeSlug/modelName to ListingWithImages"
```

---

## Task 4: listing-card — new props and route

**Files:**
- Modify: `src/components/listings/listing-card.tsx`

`ListingCard` must accept `makeSlug` and `modelName` to build the slug, use `listing.short_id` for the route param, and update `data-listing-id` to use `short_id` (the e2e `cardById` helper keys off this attribute).

- [ ] **Step 1: Replace `src/components/listings/listing-card.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { MOTORCYCLE_TYPES, REGIONS, TYPE_EMOJI } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { computeListingSlug } from "~/lib/slug";

interface ListingCardProps {
	listing: Listing;
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
	isOwn?: boolean;
}

export function ListingCard({ listing, images, makeSlug, modelName, isOwn }: ListingCardProps) {
	const { t } = useTranslation("listings");
	const firstImage = images[0];
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const typeEmoji = TYPE_EMOJI[listing.motorcycle_type] ?? "";

	const isNew = Date.now() - new Date(listing.created_at).getTime() < 48 * 60 * 60 * 1000;
	const imageCount = images.length;
	const slug = computeListingSlug(makeSlug, modelName, listing.city);

	return (
		<Link
			data-testid="listing-card"
			data-listing-id={listing.short_id}
			to="/ilmoitukset/$listingId/$slug"
			params={{ listingId: listing.short_id, slug }}
			className="group block overflow-hidden rounded-xl border border-border bg-card card-hover hover:card-hover-active"
		>
			{/* Image */}
			<div className="relative aspect-[16/10] overflow-hidden bg-muted-light">
				{firstImage ? (
					<img
						src={firstImage.url}
						alt={listing.title}
						loading="lazy"
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
				<div className="absolute top-2.5 left-2.5 flex gap-1.5">
					{isNew && (
						<span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-white">
							{t("card.newBadge")}
						</span>
					)}
					{isOwn ? (
						<span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
							{t("card.ownBadge")}
						</span>
					) : null}
				</div>

				{/* Favorite button placeholder */}
				<button
					type="button"
					className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-muted transition-transform hover:scale-110"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					aria-label={t("card.addToFavoritesAriaLabel")}
				>
					<Heart className="h-4 w-4" />
				</button>

				{/* Frosted trust bar at bottom of image */}
				<div className="absolute right-0 bottom-0 left-0 flex items-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent px-3 pt-6 pb-2.5">
					{imageCount > 1 && (
						<span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
							📷 {imageCount}
						</span>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="mb-1 flex items-start justify-between gap-2">
					<h3
						data-testid="listing-card-title"
						className="line-clamp-1 text-sm font-semibold text-foreground leading-tight"
					>
						{listing.title}
					</h3>
					{!!listing.required_license && (
						<span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
							{listing.required_license}
						</span>
					)}
				</div>

				<p className="mt-1 text-xs text-muted">
					{typeEmoji} {typeLabel}
					{listing.engine_cc ? ` · ${listing.engine_cc} cc` : ""}
				</p>

				{/* Footer with border-top */}
				<div className="mt-3 flex items-center justify-between border-t border-border pt-3">
					<span className="text-xs text-muted">
						{listing.city}, {regionLabel}
					</span>
					<div className="text-right">
						<span
							data-testid="listing-card-price"
							className="font-heading text-lg font-bold text-accent"
						>
							{formatEur(listing.price_per_day)}
						</span>
						<span className="text-xs text-muted">{t("card.perDay")}</span>
					</div>
				</div>
			</div>
		</Link>
	);
}
```

- [ ] **Step 2: Fix callers that pass `listing` without the new props**

`src/routes/profiili/$userId.tsx` passes `<ListingCard listing={listing} images={...} />` — TypeScript will complain. Fix it in Task 8. For now, note the error.

- [ ] **Step 3: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/components/listings/listing-card.tsx && git commit -m "feat: listing-card uses short_id + slug route"
```

---

## Task 5: New detail route

**Files:**
- Create: `src/routes/ilmoitukset/$listingId_.$slug.tsx`
- Delete: `src/routes/ilmoitukset/$listingId.tsx`

The route now looks up by `short_id` instead of `id`. The `$slug` param is ignored at runtime. The `getListing` handler also selects `motorcycle_make.slug` so the component can build canonical URLs.

- [ ] **Step 1: Create `src/routes/ilmoitukset/$listingId_.$slug.tsx`**

```tsx
// src/routes/ilmoitukset/$listingId_.$slug.tsx
// $slug is decorative — only $listingId (the short_id) is used for DB lookup.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { Button } from "~/components/ui/button";
import {
	LICENSE_CLASSES,
	LISTING_STATUSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SITE_NAME,
	SITE_URL,
} from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";

// In-memory dedup for view count increments (per-process, 60s TTL, 10k cap)
const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

function maybeIncrementViewCount(shortId: string, userId: string | undefined) {
	const request = getRequest();
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	// When the set is full, dedup stops and every view is counted (fail-open).
	const dedupKey = userId ? `view:${shortId}:${userId}` : `view:${shortId}:${ip}`;
	if (viewedRecently.size < VIEW_DEDUP_MAX && viewedRecently.has(dedupKey)) {
		return;
	}
	if (viewedRecently.size < VIEW_DEDUP_MAX) {
		viewedRecently.add(dedupKey);
		setTimeout(() => viewedRecently.delete(dedupKey), 60_000);
	}
	// updated_at intentionally omitted — view bumps should not surface listings
	// as "recently updated" in sorting or the sitemap lastmod.
	db.updateTable("listing")
		.set({ view_count: sql`view_count + 1` })
		.where("short_id", "=", shortId)
		.execute()
		.catch(() => {});
}

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();

		const row = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.selectAll("listing")
			.select([
				"motorcycle_make.name as makeName",
				"motorcycle_make.slug as makeSlug",
				"motorcycle_model.name as modelName",
			])
			.where("listing.short_id", "=", shortId)
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const { makeName, makeSlug, modelName, ...listing } = row;

		maybeIncrementViewCount(shortId, session?.user.id);

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute();

		const ownerRow = await db
			.selectFrom("profile")
			.select(["display_name", "city", "phone", "show_phone"])
			.where("user_id", "=", listing.owner_id)
			.executeTakeFirst();

		// Gate contact details: only signed-in users get phone (and only if owner opted in),
		// and the email address is exposed only to the owner themselves.
		const isOwner = session?.user.id === listing.owner_id;
		const isSignedIn = !!session;
		const phone = ownerRow && isSignedIn && ownerRow.show_phone ? ownerRow.phone : null;
		const owner = ownerRow
			? { display_name: ownerRow.display_name, city: ownerRow.city, phone }
			: null;

		let ownerEmail: string | null = null;
		if (isOwner) {
			const ownerUser = await db
				.selectFrom("user")
				.select(["email"])
				.where("id", "=", listing.owner_id)
				.executeTakeFirst();
			ownerEmail = ownerUser?.email ?? null;
		}

		return {
			listing,
			images,
			owner,
			ownerEmail,
			makeName: makeName ?? null,
			makeSlug: makeSlug ?? null,
			modelName: modelName ?? null,
		};
	});

export const Route = createFileRoute("/ilmoitukset/$listingId_/$slug")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		return { ...result, session };
	},
	head: ({ loaderData }) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const make = loaderData?.makeName ?? "";
		const model = loaderData?.modelName ?? "";
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Vuokraa ${make} ${model} (${l.year}) — ${l.city}. Alkaen ${(l.price_per_day / 100).toFixed(0)} €/pv.`;
		const slug = computeListingSlug(
			loaderData?.makeSlug ?? null,
			loaderData?.modelName ?? null,
			l.city,
		);
		const url = `${SITE_URL}/ilmoitukset/${l.short_id}/${slug}`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:title", content: title },
				{ property: "og:description", content: desc },
				{ property: "og:url", content: url },
			],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: ListingDetailPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div
				data-testid="listing-not-found"
				className="flex min-h-screen flex-col items-center justify-center gap-4"
			>
				<p className="text-muted">{t("detail.notFound")}</p>
				<Link to="/" className="text-sm text-accent underline">
					{t("detail.notFoundBack")}
				</Link>
			</div>
		);
	},
});

function ListingSpecs({
	listing,
	makeName,
	modelName,
}: {
	listing: Listing;
	makeName: string | null;
	modelName: string | null;
}) {
	const { t } = useTranslation("listings");

	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<h2 className="mb-3 text-sm font-semibold text-foreground">{t("detail.specs.heading")}</h2>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				{!!makeName && (
					<div>
						<dt className="text-muted">{t("detail.specs.brand")}</dt>
						<dd className="font-medium text-foreground">{makeName}</dd>
					</div>
				)}
				{!!modelName && (
					<div>
						<dt className="text-muted">{t("detail.specs.model")}</dt>
						<dd className="font-medium text-foreground">{modelName}</dd>
					</div>
				)}
				<div>
					<dt className="text-muted">{t("detail.specs.year")}</dt>
					<dd className="font-medium text-foreground">{listing.year}</dd>
				</div>
				{!!listing.engine_cc && (
					<div>
						<dt className="text-muted">{t("detail.specs.engine")}</dt>
						<dd className="font-medium text-foreground">
							{listing.engine_cc} {t("detail.specs.engineUnit")}
						</dd>
					</div>
				)}
				{!!listing.mileage_limit && (
					<div>
						<dt className="text-muted">{t("detail.specs.mileageLimit")}</dt>
						<dd className="font-medium text-foreground">
							{listing.mileage_limit} {t("detail.specs.mileageLimitUnit")}
						</dd>
					</div>
				)}
			</dl>
		</div>
	);
}

interface PricingCardProps {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	listing: Listing;
	owner: { display_name: string | null; city: string | null; phone: string | null } | null;
	ownerEmail: string | null;
	isOwner: boolean;
	isSignedIn: boolean;
	makeSlug: string | null;
	modelName: string | null;
}

function PricingCard({
	pricePerDayCents,
	pricePerWeekCents,
	listing,
	owner,
	ownerEmail,
	isOwner,
	isSignedIn,
	makeSlug,
	modelName,
}: PricingCardProps) {
	const { t } = useTranslation("listings");
	const [contactVisible, setContactVisible] = useState(false);
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	const redirectPath = `/ilmoitukset/${listing.short_id}/${slug}`;

	return (
		<div className="rounded-xl border border-border bg-card p-5 shadow-sm">
			<div data-testid="price-info" className="mb-4">
				<span data-testid="price-per-day" className="text-3xl font-bold text-accent">
					{formatEur(pricePerDayCents)}
				</span>
				<span className="ml-1 text-sm text-muted">{t("detail.pricing.perDay")}</span>
				{!!pricePerWeekCents && (
					<div data-testid="price-per-week" className="mt-1 text-sm text-muted">
						{t("detail.pricing.perWeek", { price: formatEur(pricePerWeekCents) })}
					</div>
				)}
				{!!listing.price_description && (
					<div className="mt-1 text-xs text-muted">{listing.price_description}</div>
				)}
			</div>

			{/* Contact reveal — gated behind sign-in to deter scrapers */}
			{!isSignedIn ? (
				<Link
					data-testid="owner-contact-login"
					to="/kirjaudu"
					search={{ redirect: redirectPath }}
					className="block w-full rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-white hover:bg-accent-hover"
				>
					{t("detail.contact.loginPrompt")}
				</Link>
			) : !contactVisible ? (
				<Button
					data-testid="owner-contact-reveal"
					onClick={() => setContactVisible(true)}
					className="w-full bg-accent text-white hover:bg-accent-hover"
				>
					{t("detail.contact.reveal")}
				</Button>
			) : (
				<div
					data-testid="owner-contact"
					className="space-y-2 rounded-lg bg-muted-light p-3 text-sm"
				>
					<Link
						data-testid="owner-name"
						to="/profiili/$userId"
						params={{ userId: listing.owner_id }}
						className="block font-medium text-foreground hover:text-accent"
					>
						{owner?.display_name ?? t("detail.contact.fallbackName")}
					</Link>
					{!!owner?.phone && (
						<a
							data-testid="owner-phone"
							href={`tel:${owner.phone}`}
							className="block text-accent hover:underline"
						>
							{owner.phone}
						</a>
					)}
					{!!ownerEmail && (
						<a
							data-testid="owner-email"
							href={`mailto:${ownerEmail}`}
							className="block text-accent hover:underline"
						>
							{ownerEmail}
						</a>
					)}
					{!!owner?.city && (
						<p data-testid="owner-city" className="text-muted">
							{owner.city}
						</p>
					)}
				</div>
			)}

			{/* Owner actions */}
			{!!isOwner && (
				<div className="mt-3 flex gap-2">
					<Link
						data-testid="listing-edit-link"
						to="/ilmoitukset/$listingId/muokkaa"
						params={{ listingId: listing.short_id }}
						className="flex-1"
					>
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.edit")}
						</Button>
					</Link>
					<Link data-testid="listing-owner-profile-link" to="/omat" className="flex-1">
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.myListings")}
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}

function ListingDetailPage() {
	const { t } = useTranslation("listings");
	const { listing, images, owner, ownerEmail, session, makeName, makeSlug, modelName } =
		Route.useLoaderData();

	const isOwner = session?.user.id === listing.owner_id;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
	const statusLabel = LISTING_STATUSES[listing.status];
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	const redirectPath = `/ilmoitukset/${listing.short_id}/${slug}`;

	return (
		<div data-testid="listing-detail" className="min-h-screen bg-background pb-20 md:pb-0">
			<div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
				{/* Back */}
				<Link
					data-testid="listing-detail-back"
					to="/ilmoitukset"
					className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("detail.back")}
				</Link>

				<div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
					{/* Left column */}
					<div className="space-y-4">
						<ListingGallery images={images} title={listing.title} />

						{/* Title + badges */}
						<div>
							<div className="flex items-start justify-between gap-3">
								<h1
									data-testid="listing-detail-title"
									className="text-xl font-bold text-primary md:text-2xl"
								>
									{listing.title}
								</h1>
								<div className="flex shrink-0 gap-2">
									{!!isOwner && (
										<span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
											{t("card.ownBadge")}
										</span>
									)}
									{listing.status !== "active" && (
										<span
											data-testid="listing-status-badge"
											className="rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning"
										>
											{statusLabel}
										</span>
									)}
								</div>
							</div>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								<span
									data-testid="listing-type"
									className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
								>
									<Tag className="h-3 w-3" />
									{typeLabel}
								</span>
								<span
									data-testid="location-info"
									className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
								>
									<MapPin className="h-3 w-3" />
									{listing.city}, {regionLabel}
								</span>
								{!!licenseLabel && (
									<span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
										{t("detail.licenseBadge", { license: licenseLabel })}
									</span>
								)}
							</div>
						</div>

						<ListingSpecs listing={listing} makeName={makeName} modelName={modelName} />

						{/* Description */}
						<div>
							<h2 className="mb-1.5 text-sm font-semibold text-foreground">
								{t("detail.description")}
							</h2>
							<p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
								{listing.description}
							</p>
						</div>
					</div>

					{/* Pricing — inline below content on mobile, sticky sidebar on desktop */}
					<div id="pricing" className="space-y-4 lg:sticky lg:top-8 lg:self-start">
						<PricingCard
							pricePerDayCents={listing.price_per_day}
							pricePerWeekCents={listing.price_per_week ?? null}
							listing={listing}
							owner={owner}
							ownerEmail={ownerEmail}
							isOwner={!!isOwner}
							isSignedIn={!!session}
							makeSlug={makeSlug}
							modelName={modelName}
						/>
						<p className="text-center text-xs text-muted">
							{t("detail.viewCount", { n: listing.view_count })}
						</p>
						{!!session && !isOwner && (
							<div className="text-center">
								<ReportButton targetType="listing" targetId={listing.id} />
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Sticky bottom bar on mobile — quick price + CTA */}
			<div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden">
				<div className="flex items-center justify-between gap-4">
					<div>
						<span className="text-lg font-bold text-accent">
							{formatEur(listing.price_per_day)}
						</span>
						<span className="ml-1 text-xs text-muted">{t("detail.pricing.perDay")}</span>
					</div>
					{!session ? (
						<Link
							to="/kirjaudu"
							search={{ redirect: redirectPath }}
							className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
						>
							{t("detail.contact.loginPrompt")}
						</Link>
					) : (
						<a
							href="#pricing"
							className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
						>
							{t("detail.contact.reveal")}
						</a>
					)}
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Delete old route file**

```bash
rm /home/cride/workspace/vuokramoto/src/routes/ilmoitukset/'$listingId.tsx'
```

- [ ] **Step 3: Regenerate route tree**

```bash
cd /home/cride/workspace/vuokramoto && pnpm build 2>&1 | tail -20
```

This regenerates `routeTree.gen.ts`. Expect build errors from call sites not yet updated — that's fine.

- [ ] **Step 4: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/routes/ilmoitukset/ && git commit -m "feat: detail route — $listingId_.\$slug.tsx, lookup by short_id"
```

---

## Task 6: uusi.tsx — generate short_id, navigate to new route

**Files:**
- Modify: `src/routes/ilmoitukset/uusi.tsx`

`createListing` now generates and stores `short_id`, and returns the info needed for the post-create redirect.

- [ ] **Step 1: Replace `src/routes/ilmoitukset/uusi.tsx`**

```tsx
// src/routes/ilmoitukset/uusi.tsx
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ListingForm } from "~/components/listings/listing-form";
import { SITE_NAME } from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { computeListingSlug, generateShortId } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { isValidImageUrl, listingFormSchema } from "~/lib/validators";

const createListing = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "create-listing"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: ListingFormData) => listingFormSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ensin");
		}

		// Validate image URLs — must be from our storage (Cloudflare or local dev)
		if (data.images.some((img) => !isValidImageUrl(img.url))) {
			throw new Error("Virheellinen kuva-URL");
		}

		const id = crypto.randomUUID();
		const shortId = generateShortId();
		const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

		await db
			.insertInto("listing")
			.values({
				id,
				short_id: shortId,
				owner_id: session.user.id,
				title: data.title,
				make_id: data.make_id,
				model_id: data.model_id ?? null,
				year: data.year,
				engine_cc: data.engine_cc ?? null,
				required_license: data.required_license ?? null,
				motorcycle_type: data.motorcycle_type,
				price_per_day: Math.round(data.price_per_day * 100),
				price_per_week: data.price_per_week ? Math.round(data.price_per_week * 100) : null,
				price_description: data.price_description ?? null,
				city: data.city,
				region: data.region,
				postal_code: data.postal_code ?? null,
				description: data.description,
				mileage_limit: data.mileage_limit ?? null,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		log.event(EVENTS.listing.created, { listingId: id });

		if (data.images.length > 0) {
			await db
				.insertInto("listing_image")
				.values(
					data.images.map((img, i) => ({
						id: crypto.randomUUID(),
						listing_id: id,
						url: img.url,
						thumbnail_url: img.thumbnail_url ?? null,
						order: i,
					})),
				)
				.execute();
		}

		const make = await db
			.selectFrom("motorcycle_make")
			.select(["slug"])
			.where("id", "=", data.make_id)
			.executeTakeFirst();

		const model = data.model_id
			? await db
					.selectFrom("motorcycle_model")
					.select(["name"])
					.where("id", "=", data.model_id)
					.executeTakeFirst()
			: null;

		return {
			shortId,
			makeSlug: make?.slug ?? null,
			modelName: model?.name ?? null,
			city: data.city,
		};
	});

export const Route = createFileRoute("/ilmoitukset/uusi")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		return { session };
	},
	head: () => ({
		meta: [{ title: `Uusi ilmoitus — ${SITE_NAME}` }],
	}),
	component: NewListingPage,
});

function NewListingPage() {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	async function handleSubmit(data: ListingFormData) {
		const result = await createListing({ data });
		const slug = computeListingSlug(result.makeSlug, result.modelName, result.city);
		navigate({
			to: "/ilmoitukset/$listingId/$slug",
			params: { listingId: result.shortId, slug },
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-primary">{t("create.pageTitle")}</h1>
					<p className="mt-1 text-sm text-muted">{t("create.pageSubtitle")}</p>
				</div>
				<ListingForm onSubmit={handleSubmit} submitLabel={t("create.submitLabel")} />
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck 2>&1 | grep "uusi" | head -10
```

Expected: no errors in `uusi.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/routes/ilmoitukset/uusi.tsx && git commit -m "feat: create listing generates short_id, redirects to slug URL"
```

---

## Task 7: muokkaa.tsx — lookup by short_id, navigate to new route

**Files:**
- Modify: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`

`getListingForEdit` now receives `short_id` from the URL param, joins make/model for slug construction, and the post-update navigate targets the two-segment route.

- [ ] **Step 1: Replace `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`**

```tsx
// src/routes/ilmoitukset/$listingId_.muokkaa.tsx
// Trailing underscore on $listingId_ opts out of $listingId_.$slug.tsx as parent layout.
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "~/components/listings/listing-form";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { isValidImageUrl, listingFormSchema } from "~/lib/validators";

const getListingForEdit = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const row = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.selectAll("listing")
			.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
			.where("listing.short_id", "=", shortId)
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const { makeSlug, modelName, ...listing } = row;

		if (listing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute();

		return { listing, images, makeSlug: makeSlug ?? null, modelName: modelName ?? null };
	});

const updateListing = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "update-listing"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: { id: string; form: ListingFormData }) => ({
		id: data.id,
		form: listingFormSchema.parse(data.form),
	}))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		// Validate image URLs — must be from our storage (Cloudflare or local dev)
		if (data.form.images.some((img) => !isValidImageUrl(img.url))) {
			throw new Error("Virheellinen kuva-URL");
		}

		const existing = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", data.id)
			.executeTakeFirst();

		if (!existing) {
			throw new Error("Ilmoitusta ei löydy");
		}
		if (existing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		const { form } = data;

		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({
					title: form.title,
					make_id: form.make_id,
					model_id: form.model_id ?? null,
					year: form.year,
					engine_cc: form.engine_cc ?? null,
					required_license: form.required_license ?? null,
					motorcycle_type: form.motorcycle_type,
					price_per_day: Math.round(form.price_per_day * 100),
					price_per_week: form.price_per_week ? Math.round(form.price_per_week * 100) : null,
					price_description: form.price_description ?? null,
					city: form.city,
					region: form.region,
					postal_code: form.postal_code ?? null,
					description: form.description,
					mileage_limit: form.mileage_limit ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", data.id)
				.execute();

			await trx.deleteFrom("listing_image").where("listing_id", "=", data.id).execute();

			if (form.images.length > 0) {
				await trx
					.insertInto("listing_image")
					.values(
						form.images.map((img, i) => ({
							id: crypto.randomUUID(),
							listing_id: data.id,
							url: img.url,
							thumbnail_url: img.thumbnail_url ?? null,
							order: i,
						})),
					)
					.execute();
			}
		});

		log.event(EVENTS.listing.updated, {
			listingId: data.id,
			fields: Object.keys(data.form).filter((k) => k !== "id"),
		});
	});

export const Route = createFileRoute("/ilmoitukset/$listingId_/muokkaa")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		const result = await getListingForEdit({ data: params.listingId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	component: EditListingPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-muted">{t("edit.notFound")}</p>
				<Link to="/omat" className="text-sm text-accent underline">
					{t("edit.notFoundBack")}
				</Link>
			</div>
		);
	},
});

function EditListingPage() {
	const { t } = useTranslation("listings");
	const { listing, images, makeSlug, modelName } = Route.useLoaderData();
	const navigate = useNavigate();

	const initialValues = {
		title: listing.title,
		make_id: listing.make_id,
		model_id: listing.model_id ?? null,
		year: listing.year,
		engine_cc: listing.engine_cc,
		motorcycle_type: listing.motorcycle_type,
		required_license: listing.required_license,
		price_per_day: listing.price_per_day / 100,
		price_per_week: listing.price_per_week ? listing.price_per_week / 100 : null,
		price_description: listing.price_description ?? "",
		city: listing.city,
		region: listing.region,
		postal_code: listing.postal_code ?? "",
		description: listing.description,
		mileage_limit: listing.mileage_limit,
	};

	async function handleSubmit(data: ListingFormData) {
		await updateListing({ data: { id: listing.id, form: data } });
		const slug = computeListingSlug(makeSlug, modelName, listing.city);
		navigate({
			to: "/ilmoitukset/$listingId/$slug",
			params: { listingId: listing.short_id, slug },
			replace: true,
		});
	}

	const slug = computeListingSlug(makeSlug, modelName, listing.city);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<Link
						to="/ilmoitukset/$listingId/$slug"
						params={{ listingId: listing.short_id, slug }}
						className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						{t("edit.back")}
					</Link>
					<h1 className="text-2xl font-bold text-primary">{t("edit.pageTitle")}</h1>
					<p className="mt-1 text-sm text-muted">{listing.title}</p>
				</div>
				<ListingForm
					initialValues={initialValues}
					initialImages={images.map((img) => ({ url: img.url, thumbnail_url: img.thumbnail_url }))}
					onSubmit={handleSubmit}
					submitLabel={t("edit.submitLabel")}
				/>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add 'src/routes/ilmoitukset/$listingId_.muokkaa.tsx' && git commit -m "feat: edit route — lookup by short_id, navigate to slug URL"
```

---

## Task 8: omat/index.tsx — add make/model join, update Links

**Files:**
- Modify: `src/routes/omat/index.tsx`

`getMyListings` joins make/model so the dashboard links can build the two-segment URL. `data-listing-id` switches to `short_id` (needed by the e2e `dashboard.listingRow(listingId)` helper).

- [ ] **Step 1: Update `getMyListings` query**

In `src/routes/omat/index.tsx`, replace the `getMyListings` handler's listings query (lines 22–28):

```ts
	const listings = await db
		.selectFrom("listing")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.selectAll("listing")
		.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
		.where("owner_id", "=", session.user.id)
		.where("listing.status", "!=", "removed")
		.orderBy("listing.created_at", "desc")
		.execute();
```

- [ ] **Step 2: Update `ListingRow` props and links**

In `src/routes/omat/index.tsx`, update `ListingRow` props interface:

```ts
interface ListingRowProps {
	listing: Listing & { makeSlug: string | null; modelName: string | null };
	firstImage: ListingImage | undefined;
	onStatusChange: () => void;
	verified: boolean | null;
}
```

Update `data-listing-id` in the row div:

```tsx
data-listing-id={listing.short_id}
```

Update all four `Link` components and the `navigate` call that use `listing.id` as `listingId`:

```tsx
// Thumbnail link
to="/ilmoitukset/$listingId/$slug"
params={{ listingId: listing.short_id, slug: computeListingSlug(listing.makeSlug, listing.modelName, listing.city) }}

// Title link (same params)
to="/ilmoitukset/$listingId/$slug"
params={{ listingId: listing.short_id, slug: computeListingSlug(listing.makeSlug, listing.modelName, listing.city) }}

// Edit link
to="/ilmoitukset/$listingId/muokkaa"
params={{ listingId: listing.short_id }}
```

Add the import at the top of the file:

```ts
import { computeListingSlug } from "~/lib/slug";
```

- [ ] **Step 3: Typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck 2>&1 | grep "omat" | head -10
```

- [ ] **Step 4: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/routes/omat/index.tsx && git commit -m "feat: dashboard links use short_id + slug route"
```

---

## Task 9: profiili/$userId.tsx — join make/model, pass to ListingCard

**Files:**
- Modify: `src/routes/profiili/$userId.tsx`

`getPublicProfile` joins make/model for each listing so `ListingCard` can receive `makeSlug` and `modelName`.

- [ ] **Step 1: Update `getPublicProfile` listings query**

In `src/routes/profiili/$userId.tsx`, replace the listings query:

```ts
		const listings = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.selectAll("listing")
			.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
			.where("owner_id", "=", userId)
			.where("listing.status", "=", "active")
			.orderBy("listing.created_at", "desc")
			.execute();
```

- [ ] **Step 2: Thread makeSlug/modelName into ListingCard**

In `PublicProfilePage`, update the `ListingCard` usage:

```tsx
{listings.map((listing) => (
	<ListingCard
		key={listing.id}
		listing={listing}
		images={imagesByListing.get(listing.id) ?? []}
		makeSlug={listing.makeSlug}
		modelName={listing.modelName}
	/>
))}
```

- [ ] **Step 3: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add 'src/routes/profiili/$userId.tsx' && git commit -m "feat: public profile ListingCard receives makeSlug/modelName"
```

---

## Task 10: sitemap — short_id + slug URLs

**Files:**
- Modify: `src/routes/sitemap[.]xml.ts`

- [ ] **Step 1: Replace `src/routes/sitemap[.]xml.ts`**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { computeListingSlug } from "~/lib/slug";

const STATIC_PATHS = [
	{ path: "/", priority: "1.0", changefreq: "daily" },
	{ path: "/ilmoitukset", priority: "0.9", changefreq: "daily" },
	{ path: "/kayttoehdot", priority: "0.3", changefreq: "yearly" },
	{ path: "/tietosuoja", priority: "0.3", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const listings = await db
					.selectFrom("listing")
					.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
					.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
					.select([
						"listing.short_id",
						"listing.city",
						"listing.updated_at",
						"motorcycle_make.slug as makeSlug",
						"motorcycle_model.name as modelName",
					])
					.where("listing.status", "=", "active")
					.orderBy("listing.updated_at", "desc")
					.limit(50_000)
					.execute();

				const urls = [
					...STATIC_PATHS.map(
						(p) =>
							`<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
					),
					...listings.map((l) => {
						const slug = computeListingSlug(l.makeSlug ?? null, l.modelName ?? null, l.city);
						return `<url><loc>${SITE_URL}/ilmoitukset/${l.short_id}/${slug}</loc><lastmod>${new Date(l.updated_at).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
					}),
				];

				const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

				return new Response(xml, {
					headers: {
						"Content-Type": "application/xml",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add 'src/routes/sitemap[.]xml.ts' && git commit -m "feat: sitemap uses short_id + slug listing URLs"
```

---

## Task 11: reports.ts + moderation.tsx — admin listing URLs

**Files:**
- Modify: `src/lib/reports.ts`
- Modify: `src/routes/admin/moderation.tsx`

The admin listing links (both review queue and reports) need `short_id` + slug.

- [ ] **Step 1: Update `getUnreviewedListings` in `src/lib/reports.ts`**

Add `listing.short_id`, `motorcycle_make.slug`, and `motorcycle_model.name` to the select in `getUnreviewedListings`:

```ts
		const [rows, countResult] = await Promise.all([
			db
				.selectFrom("listing")
				.innerJoin("user", "user.id", "listing.owner_id")
				.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
				.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
				.select([
					"listing.id",
					"listing.short_id",
					"listing.title",
					"listing.status",
					"listing.city",
					"listing.created_at",
					"user.name as ownerName",
					"motorcycle_make.slug as makeSlug",
					"motorcycle_model.name as modelName",
				])
				.where("listing.reviewed_at", "is", null)
				.where("listing.status", "!=", "removed")
				.orderBy("listing.created_at", "desc")
				.limit(PAGE_SIZE)
				.offset(offset)
				.execute(),
			// count query unchanged
		]);
```

- [ ] **Step 2: Update `getReports` in `src/lib/reports.ts`**

Add make/model joins and select `listing.short_id`, `listing.city`, `motorcycle_make.slug`, `motorcycle_model.name` for building listing URLs:

```ts
		let query = db
			.selectFrom("report")
			.innerJoin("user as reporter", "reporter.id", "report.reporter_id")
			.leftJoin("listing", (join) =>
				join
					.onRef("listing.id", "=", "report.target_id")
					.on("report.target_type", "=", "listing"),
			)
			.leftJoin("motorcycle_make", (join) =>
				join
					.onRef("motorcycle_make.id", "=", "listing.make_id")
					.on("report.target_type", "=", "listing"),
			)
			.leftJoin("motorcycle_model", (join) =>
				join
					.onRef("motorcycle_model.id", "=", "listing.model_id")
					.on("report.target_type", "=", "listing"),
			)
			.leftJoin("user as target_user", (join) =>
				join
					.onRef("target_user.id", "=", "report.target_id")
					.on("report.target_type", "=", "user"),
			)
			.select([
				"report.id",
				"report.target_type",
				"report.target_id",
				"report.reason",
				"report.status",
				"report.admin_note",
				"report.created_at",
				"reporter.name as reporterName",
				sql<string | null>`coalesce(listing.title, target_user.name)`.as("targetName"),
				sql<string | null>`listing.short_id`.as("listingShortId"),
				sql<string | null>`listing.city`.as("listingCity"),
				sql<string | null>`motorcycle_make.slug`.as("listingMakeSlug"),
				sql<string | null>`motorcycle_model.name`.as("listingModelName"),
			]);
```

- [ ] **Step 3: Update admin moderation listing hrefs in `src/routes/admin/moderation.tsx`**

Add import at top:

```ts
import { computeListingSlug } from "~/lib/slug";
```

In `NewListingsTab`, replace the listing href:

```tsx
href={`/ilmoitukset/${listing.short_id}/${computeListingSlug(listing.makeSlug ?? null, listing.modelName ?? null, listing.city)}`}
```

In the reports tab, replace the target link href:

```tsx
href={
	report.target_type === "listing" && report.listingShortId
		? `/ilmoitukset/${report.listingShortId}/${computeListingSlug(report.listingMakeSlug ?? null, report.listingModelName ?? null, report.listingCity ?? "")}`
		: `/profiili/${report.target_id}`
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck 2>&1 | grep -E "reports|moderation" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/lib/reports.ts src/routes/admin/moderation.tsx && git commit -m "feat: admin listing links use short_id + slug"
```

---

## Task 12: seed.ts — add short_id

**Files:**
- Modify: `src/lib/db/seed.ts`

- [ ] **Step 1: Update listing insert in `src/lib/db/seed.ts`**

Add the import:

```ts
import { generateShortId } from "~/lib/slug";
```

In the listing insert loop (around line 310), generate and include `short_id`:

```ts
	for (const seed of listings) {
		const id = crypto.randomUUID();
		const shortId = generateShortId();
		const make = makeBySlug[seed.makeSlug];
		// ...

		await db
			.insertInto("listing")
			.values({
				id,
				short_id: shortId,
				owner_id: userId,
				// ... rest unchanged
			})
			.execute();
```

- [ ] **Step 2: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add src/lib/db/seed.ts && git commit -m "feat: seed generates short_id for listings"
```

---

## Task 13: e2e updates

**Files:**
- Modify: `e2e/global-setup.ts`
- Modify: `e2e/pages/listing-detail.page.ts`
- Modify: `e2e/tests/listings.spec.ts`
- Modify: `e2e/tests/listing-lifecycle.spec.ts`

- [ ] **Step 1: Update `e2e/global-setup.ts`**

Change `SEEDED_LISTING_ID` to the short_id (used in URLs and `data-listing-id`). Keep the UUID `id` as a separate constant for DB idempotency cleanup.

```ts
// Deterministic IDs for the e2e seed listing
export const SEEDED_LISTING_UUID = "e2e-seed-honda-cb500f-uusimaa"; // stable DB id
export const SEEDED_LISTING_ID = "e2eseed1"; // short_id — used in URLs and data-listing-id
export const SEEDED_LISTING_SLUG = "honda-e2e-helsinki"; // make slug + city
export const SEEDED_LISTING_TITLE = "E2E Seed Honda CB500F 2022";
```

Update `seedListings` to use `SEEDED_LISTING_UUID` for cleanup and include `short_id`:

```ts
async function seedListings(ownerId: string) {
	const { db } = await import("../src/lib/db/index");

	await db.deleteFrom("listing").where("id", "=", SEEDED_LISTING_UUID).execute();

	const priorMake = await db
		.selectFrom("motorcycle_make")
		.select("id")
		.where("slug", "=", "honda-e2e")
		.executeTakeFirst();
	if (priorMake) {
		await db.deleteFrom("listing").where("make_id", "=", priorMake.id).execute();
		await db.deleteFrom("motorcycle_make").where("id", "=", priorMake.id).execute();
	}
	const e2eMake = await db
		.insertInto("motorcycle_make")
		.values({ id: crypto.randomUUID(), name: "Honda", slug: "honda-e2e" })
		.returningAll()
		.executeTakeFirstOrThrow();

	await db
		.insertInto("listing")
		.values({
			id: SEEDED_LISTING_UUID,
			short_id: SEEDED_LISTING_ID,
			owner_id: ownerId,
			title: SEEDED_LISTING_TITLE,
			make_id: e2eMake.id,
			model_id: null,
			year: 2022,
			engine_cc: 471,
			required_license: "A2",
			motorcycle_type: "naked",
			price_per_day: 5500,
			price_per_week: 30000,
			price_description: null,
			city: "Helsinki",
			region: "uusimaa",
			postal_code: null,
			description:
				"E2E seed listing. Do not edit manually — global-setup recreates this row on every run.",
			mileage_limit: 200,
			expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();
}
```

- [ ] **Step 2: Update `e2e/pages/listing-detail.page.ts`**

Change `goto` to accept both `shortId` and `slug`:

```ts
	async goto(shortId: string, slug: string) {
		await this.page.goto(`/ilmoitukset/${shortId}/${slug}`);
		await waitForHydration(this.page);
	}
```

- [ ] **Step 3: Update `e2e/tests/listings.spec.ts`**

```ts
import { expect, test } from "../fixtures";
import {
	SEEDED_LISTING_ID,
	SEEDED_LISTING_SLUG,
	SEEDED_LISTING_TITLE,
} from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingsPage } from "../pages/listings.page";

test.describe("Listings browse", () => {
	test("renders search bar and result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await expect(listings.searchInput).toBeVisible();
		await expect(listings.searchSubmit).toBeVisible();
		await expect(listings.resultCount).toBeVisible();
	});

	test("search updates URL with query", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.search("Honda");
		await expect(page).toHaveURL(/q=Honda/);
		await expect(listings.resultCount).toBeVisible();
	});

	test("region URL param shows region label in result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ region: "uusimaa" });
		await expect(listings.regionLabel).toHaveText("Uusimaa");
	});

	test("empty search shows empty state", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "xyznonexistentmotorcycle12345" });
		await expect(listings.emptyState).toBeVisible();
	});

	test("seeded listing is visible and links to detail page", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "CB500F" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
		await expect(seeded).toContainText(SEEDED_LISTING_TITLE);
		await seeded.click();
		await expect(page).toHaveURL(
			new RegExp(`/ilmoitukset/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}$`),
		);
	});
});

test.describe("Listing detail", () => {
	test("renders seeded listing details", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await expect(detail.title).toHaveText(SEEDED_LISTING_TITLE);
		await expect(detail.priceInfo).toBeVisible();
		await expect(detail.pricePerDay).toContainText("55,00 €");
		await expect(detail.locationInfo).toContainText("Helsinki");
	});

	test("contact reveal exposes the owner contact block", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID, SEEDED_LISTING_SLUG);
		await expect(detail.ownerContact).toBeHidden();
		await detail.revealOwnerContact();
		await expect(detail.ownerContact).toBeVisible();
	});

	test("shows 404 for nonexistent listing", async ({ page }) => {
		const detail = new ListingDetailPage(page);
		await detail.goto("notexist1", "some-slug");
		await expect(detail.notFound).toBeVisible();
	});
});

test.describe("Listing detail (unauthenticated)", () => {
	test("new listing page redirects unauthenticated users to login", async ({ page }) => {
		await page.goto("/ilmoitukset/uusi");
		await expect(page).toHaveURL(/\/kirjaudu/);
	});
});
```

- [ ] **Step 4: Update `e2e/tests/listing-lifecycle.spec.ts`**

Replace the two URL patterns that assume a single path segment after `/ilmoitukset/`:

```ts
	// "create listing" test — wait for redirect to two-segment URL
	await page.waitForURL(
		(url) =>
			/\/ilmoitukset\/[^/]+\/[^/]+$/.test(url.pathname) &&
			url.pathname !== "/ilmoitukset/uusi",
		{ timeout: 15000 },
	);
	await waitForHydration(page);

	// Extract the short_id (first segment after /ilmoitukset/)
	const match = page.url().match(/\/ilmoitukset\/([^/]+)\/[^/]+$/);
	if (!match) {
		throw new Error("Could not extract listing short_id from URL");
	}
	listingId = match[1];
```

And:

```ts
	// "edit listing" test — wait for redirect after save
	await page.waitForURL(/\/ilmoitukset\/[^/]+\/[^/]+$/, { timeout: 15000 });
```

- [ ] **Step 5: Commit**

```bash
cd /home/cride/workspace/vuokramoto && git add e2e/ && git commit -m "feat: update e2e for short_id + slug URL pattern"
```

---

## Task 14: Final verification

- [ ] **Step 1: Full typecheck**

```bash
cd /home/cride/workspace/vuokramoto && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Unit tests**

```bash
cd /home/cride/workspace/vuokramoto && pnpm test
```

Expected: all pass.

- [ ] **Step 3: Lint**

```bash
cd /home/cride/workspace/vuokramoto && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 4: Re-seed dev DB and smoke test**

```bash
cd /home/cride/workspace/vuokramoto && pnpm db:seed
```

Start dev server and verify:
- Browse to `/ilmoitukset` → listing cards link to `/ilmoitukset/<shortId>/<make-city>` pattern
- Click a card → detail page loads, URL has two segments
- Edit a listing → navigates back to detail with two-segment URL
- Create a listing → navigates to new listing URL

- [ ] **Step 5: Run e2e**

```bash
cd /home/cride/workspace/vuokramoto && pnpm test:e2e
```

Expected: all tests pass.
