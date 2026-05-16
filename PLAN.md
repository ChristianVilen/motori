# Listings Search Unification & File Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/lib/listings-queries.ts` (950 LOC) into four focused `.server.ts` modules and collapse the rental/simple search duplication into a single config-driven pipeline.

**Architecture:** Four new `.server.ts` modules — `listings-search`, `listings-detail`, `listings-owner`, `listings-stats`. Search uses a `CategoryConfig` table and a `FILTER_PREDICATES` lookup so the rental and simple paths run through one set of `applyFilters` / `applyCursor` / `applySort` functions. All four categories join their child table as `... as child`, so the price column is always referenced through the config's `sql` fragment. The `.server.ts` naming activates TanStack Start's import-protection plugin, eliminating the lazy `getDb()` dynamic-import workaround.

**Tech Stack:** TanStack Start, Kysely, Postgres (pg), Biome, Vitest, Playwright, pnpm.

**Reference:** Spec at `docs/superpowers/specs/2026-05-16-listings-search-unification-design.md`.

**Verification policy:** Per user preference, run `pnpm typecheck` after each task. Skip lint/format/e2e per-task. Run the full suite once at the end.

**Commit style:** No `Co-Authored-By` lines.

---

## Task 1: Create `listings-stats.server.ts`

**Files:**
- Create: `src/lib/listings-stats.server.ts`

This module owns `ADJACENT_REGIONS`, `getHomepageStats`, `getNeighborRegionCount`. Verbatim move from `listings-queries.ts`, except: static `db` import (not lazy `getDb()`).

- [ ] **Step 1: Create the file with extracted code**

```ts
// src/lib/listings-stats.server.ts
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { centsToEuros } from "~/lib/currency";
import { db } from "~/lib/db/index";

const ADJACENT_REGIONS: Record<string, string[]> = {
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

export const getHomepageStats = createServerFn({ method: "GET" }).handler(async () => {
	const [countResult, priceResult] = await Promise.all([
		db
			.selectFrom("listing")
			.select([
				sql<number>`count(*)::int`.as("total"),
				sql<number>`count(distinct region)::int`.as("regions"),
			])
			.where("status", "=", "active")
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("listing_rental")
			.innerJoin("listing", "listing.id", "listing_rental.listing_id")
			.select(sql<number>`coalesce(min(listing_rental.price_per_day), 0)::int`.as("min_price"))
			.where("listing.status", "=", "active")
			.executeTakeFirstOrThrow(),
	]);

	return {
		totalListings: countResult.total,
		regionCount: countResult.regions,
		minPricePerDay: Math.round(centsToEuros(priceResult.min_price)),
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

- [ ] **Step 2: Verify typecheck still passes (old file still present)**

Run: `pnpm typecheck`
Expected: PASS — both modules coexist temporarily.

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-stats.server.ts
git commit -m "feat: extract listings-stats.server module"
```

---

## Task 2: Create `listings-owner.server.ts`

**Files:**
- Create: `src/lib/listings-owner.server.ts`

Verbatim move of `getOwnerListings` and `OwnerListingsResult` type, with static `db` import.

- [ ] **Step 1: Create the file**

```ts
// src/lib/listings-owner.server.ts
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";

export type OwnerListingsResult = {
	listings: Array<Listing & { makeSlug: string | null; modelName: string | null }>;
	images: ListingImage[];
};

export async function getOwnerListings(ownerId: string): Promise<OwnerListingsResult> {
	const listings = await db
		.selectFrom("listing")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.selectAll("listing")
		.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
		.where("owner_id", "=", ownerId)
		.where("listing.status", "!=", "removed")
		.orderBy("listing.created_at", "desc")
		.execute();

	const listingIds = listings.map((l) => l.id);
	const images =
		listingIds.length > 0
			? await db
					.selectFrom("listing_image")
					.selectAll()
					.where("listing_id", "in", listingIds)
					.orderBy("order", "asc")
					.execute()
			: [];

	return { listings, images };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-owner.server.ts
git commit -m "feat: extract listings-owner.server module"
```

---

## Task 3: Create `listings-detail.server.ts`

**Files:**
- Create: `src/lib/listings-detail.server.ts`

Moves `ListingForDisplay`, `ListingForEdit` types and `getListingForDisplay`, `getListingForEdit`, `getListingAvailability`, `recordView`. Static `db` import. `recordView` no longer needs the `void getDb().then(...)` form — uses static `db` directly.

- [ ] **Step 1: Create the file**

```ts
// src/lib/listings-detail.server.ts
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { expandDateRange } from "~/lib/bookings";
import type { Condition, GearTypeValue } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";

export type ListingForDisplay = {
	listing: Listing;
	rental: {
		price_per_day: number;
		price_per_week: number | null;
		price_per_weekend: number | null;
		price_description: string | null;
		mileage_limit: number | null;
	} | null;
	sale: {
		price: number;
		condition: Condition;
		km_driven: number | null;
		negotiable: boolean;
	} | null;
	gear: {
		gear_type: GearTypeValue;
		size: string | null;
		condition: Condition;
		price: number;
	} | null;
	part: {
		part_category: string;
		compatible_make_id: string | null;
		compatible_model_id: string | null;
		condition: Condition;
		price: number;
	} | null;
	images: ListingImage[];
	makeName: string | null;
	makeSlug: string | null;
	modelName: string | null;
	ownerContact: { phone: string | null; showPhone: boolean };
};

export async function getListingForDisplay(shortId: string): Promise<ListingForDisplay | null> {
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

	const [images, rental, sale, gear, part, ownerProfile] = await Promise.all([
		db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute(),
		listing.category === "rental"
			? db
					.selectFrom("listing_rental")
					.select([
						"price_per_day",
						"price_per_week",
						"price_per_weekend",
						"price_description",
						"mileage_limit",
					])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "sale"
			? db
					.selectFrom("listing_sale")
					.select(["price", "condition", "km_driven", "negotiable"])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "gear"
			? db
					.selectFrom("listing_gear")
					.select(["gear_type", "size", "condition", "price"])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "part"
			? db
					.selectFrom("listing_part")
					.select([
						"part_category",
						"compatible_make_id",
						"compatible_model_id",
						"condition",
						"price",
					])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		db
			.selectFrom("profile")
			.select(["phone", "show_phone"])
			.where("user_id", "=", listing.owner_id)
			.executeTakeFirst(),
	]);

	return {
		listing,
		rental: rental ?? null,
		sale: sale ?? null,
		gear: gear ?? null,
		part: part ?? null,
		images,
		makeName: makeName ?? null,
		makeSlug: makeSlug ?? null,
		modelName: modelName ?? null,
		ownerContact: {
			phone: ownerProfile?.phone ?? null,
			showPhone: ownerProfile?.show_phone ?? false,
		},
	};
}

export type ListingForEdit = {
	listing: Listing;
	rental: {
		price_per_day: number;
		price_per_week: number | null;
		price_per_weekend: number | null;
		price_description: string | null;
		mileage_limit: number | null;
		availability_default: "open" | "closed";
	} | null;
	sale: {
		price: number;
		condition: string;
		km_driven: number | null;
		negotiable: boolean;
	} | null;
	gear: {
		gear_type: string;
		size: string | null;
		condition: string;
		price: number;
	} | null;
	part: {
		part_category: string;
		compatible_make_id: string | null;
		compatible_model_id: string | null;
		condition: string;
		price: number;
	} | null;
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
};

export async function getListingForEdit(
	shortId: string,
	ownerId: string,
): Promise<ListingForEdit | null> {
	const row = await db
		.selectFrom("listing")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.selectAll("listing")
		.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
		.where("listing.short_id", "=", shortId)
		.where("listing.owner_id", "=", ownerId)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	const { makeSlug, modelName, ...listing } = row;

	const [images, rental, sale, gear, part] = await Promise.all([
		db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute(),
		listing.category === "rental"
			? db
					.selectFrom("listing_rental")
					.selectAll()
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "sale"
			? db
					.selectFrom("listing_sale")
					.select(["price", "condition", "km_driven", "negotiable"])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "gear"
			? db
					.selectFrom("listing_gear")
					.select(["gear_type", "size", "condition", "price"])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
		listing.category === "part"
			? db
					.selectFrom("listing_part")
					.select([
						"part_category",
						"compatible_make_id",
						"compatible_model_id",
						"condition",
						"price",
					])
					.where("listing_id", "=", listing.id)
					.executeTakeFirst()
			: Promise.resolve(null),
	]);

	return {
		listing,
		rental: rental ?? null,
		sale: sale ?? null,
		gear: gear ?? null,
		part: part ?? null,
		images,
		makeSlug: makeSlug ?? null,
		modelName: modelName ?? null,
	};
}

export const getListingAvailability = createServerFn({ method: "GET" })
	.inputValidator((listingId: string) => listingId)
	.handler(async ({ data: listingId }) => {
		const [listing, exceptions, confirmed] = await Promise.all([
			db
				.selectFrom("listing_rental")
				.select(["availability_default"])
				.where("listing_id", "=", listingId)
				.executeTakeFirst(),
			db
				.selectFrom("listing_availability_exception")
				.select([sql<string>`to_char(date, 'YYYY-MM-DD')`.as("date")])
				.where("listing_id", "=", listingId)
				.execute(),
			db
				.selectFrom("booking")
				.select([
					sql<string>`to_char(start_date, 'YYYY-MM-DD')`.as("start_date"),
					sql<string>`to_char(end_date, 'YYYY-MM-DD')`.as("end_date"),
				])
				.where("listing_id", "=", listingId)
				.where("status", "=", "confirmed")
				.execute(),
		]);

		if (!listing) {
			return { availability_default: "open", exception_dates: [], booked_dates: [] };
		}

		const bookedDates: string[] = [];
		for (const row of confirmed) {
			bookedDates.push(...expandDateRange(row.start_date, row.end_date));
		}

		return {
			availability_default: listing.availability_default,
			exception_dates: exceptions.map((e) => e.date),
			booked_dates: bookedDates,
		};
	});

const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

export function recordView(shortId: string, viewerId: string | undefined, ip: string): void {
	const dedupKey = viewerId ? `view:${shortId}:${viewerId}` : `view:${shortId}:${ip}`;
	if (viewedRecently.size < VIEW_DEDUP_MAX && viewedRecently.has(dedupKey)) {
		return;
	}
	if (viewedRecently.size < VIEW_DEDUP_MAX) {
		viewedRecently.add(dedupKey);
		setTimeout(() => viewedRecently.delete(dedupKey), 60_000);
	}
	void db
		.updateTable("listing")
		.set({ view_count: sql`view_count + 1` })
		.where("short_id", "=", shortId)
		.execute()
		.catch(() => {});
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-detail.server.ts
git commit -m "feat: extract listings-detail.server module"
```

---

## Task 4: Create `listings-search.server.ts` with unified pipeline

**Files:**
- Create: `src/lib/listings-search.server.ts`

The central refactor. Replaces the four pairs of near-duplicates with one `CategoryConfig`-driven pipeline. All four categories join their child table as `... as child`, so column refs are always through `config.priceColumn` (a `sql<number>` fragment).

- [ ] **Step 1: Create the file**

```ts
// src/lib/listings-search.server.ts
import { createServerFn } from "@tanstack/react-start";
import {
	type RawBuilder,
	type SelectQueryBuilder,
	type SqlBool,
	sql,
} from "kysely";
import { z } from "zod";
import { eurosToCents } from "~/lib/currency";
import { db } from "~/lib/db/index";
import type {
	Database,
	Listing,
	ListingCategory,
	ListingImage,
} from "~/lib/db/schema";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toPrefixTsQuery, toTsQuery } from "~/lib/search";
import type { BrowseSearchParams } from "~/lib/validators";

const PAGE_SIZE = 12;
const categorySchema = z.enum(["sale", "rental", "gear", "part"]);

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

type ListingSearchMode =
	| { type: "none" }
	| { type: "fts"; prefixQuery: string }
	| { type: "trigram"; raw: string };

// ─── Category configuration ──────────────────────────────────────────────────

type FilterKey =
	| "region"
	| "type"
	| "license"
	| "price_min"
	| "price_max"
	| "cc_min"
	| "cc_max"
	| "year_min"
	| "year_max"
	| "make"
	| "condition"
	| "gear_type"
	| "size"
	| "km_max"
	| "part_category";

interface CategoryConfig {
	childTable: "listing_rental" | "listing_sale" | "listing_gear" | "listing_part";
	priceColumn: RawBuilder<number>;
	supportedFilters: ReadonlyArray<FilterKey>;
}

const CATEGORY_CONFIGS: Record<ListingCategory, CategoryConfig> = {
	rental: {
		childTable: "listing_rental",
		priceColumn: sql<number>`child.price_per_day`,
		supportedFilters: [
			"region",
			"type",
			"license",
			"price_min",
			"price_max",
			"cc_min",
			"cc_max",
			"year_min",
			"year_max",
			"make",
		],
	},
	sale: {
		childTable: "listing_sale",
		priceColumn: sql<number>`child.price`,
		supportedFilters: [
			"region",
			"type",
			"license",
			"price_min",
			"price_max",
			"make",
			"condition",
			"km_max",
		],
	},
	gear: {
		childTable: "listing_gear",
		priceColumn: sql<number>`child.price`,
		supportedFilters: [
			"region",
			"price_min",
			"price_max",
			"make",
			"condition",
			"gear_type",
			"size",
		],
	},
	part: {
		childTable: "listing_part",
		priceColumn: sql<number>`child.price`,
		supportedFilters: [
			"region",
			"price_min",
			"price_max",
			"make",
			"condition",
			"part_category",
		],
	},
};

// ─── Filter predicates ───────────────────────────────────────────────────────

// Kysely's join-graph widening means we cannot precisely type the builder once
// optional joins (e.g. motorcycle_make) are conditionally added. The unified
// pipeline is internally `any`; every external boundary stays precisely typed.
// biome-ignore lint/suspicious/noExplicitAny: Kysely join graph widening prevents precise typing
type AnyQuery = SelectQueryBuilder<Database, any, object>;

type FilterPredicate = (
	q: AnyQuery,
	params: BrowseSearchParams,
	config: CategoryConfig,
) => AnyQuery;

const FILTER_PREDICATES: Record<FilterKey, FilterPredicate> = {
	region: (q, p) => (p.region ? q.where("listing.region", "=", p.region) : q),
	type: (q, p) =>
		p.type?.length ? q.where("listing.motorcycle_type", "in", p.type) : q,
	license: (q, p) =>
		p.license?.length
			? q.where("listing.required_license", "in", p.license as ("A1" | "A2" | "A")[])
			: q,
	price_min: (q, p, c) =>
		p.price_min != null ? q.where(c.priceColumn, ">=", eurosToCents(p.price_min)) : q,
	price_max: (q, p, c) =>
		p.price_max != null ? q.where(c.priceColumn, "<=", eurosToCents(p.price_max)) : q,
	cc_min: (q, p) => (p.cc_min != null ? q.where("listing.engine_cc", ">=", p.cc_min) : q),
	cc_max: (q, p) => (p.cc_max != null ? q.where("listing.engine_cc", "<=", p.cc_max) : q),
	year_min: (q, p) => (p.year_min != null ? q.where("listing.year", ">=", p.year_min) : q),
	year_max: (q, p) => (p.year_max != null ? q.where("listing.year", "<=", p.year_max) : q),
	make: (q, p) =>
		p.make
			? q
					.innerJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
					.where("motorcycle_make.slug", "=", p.make)
			: q,
	condition: (q, p) => (p.condition ? q.where(sql`child.condition`, "=", p.condition) : q),
	gear_type: (q, p) => (p.gear_type ? q.where(sql`child.gear_type`, "=", p.gear_type) : q),
	size: (q, p) => (p.size ? q.where(sql`child.size`, "=", p.size) : q),
	km_max: (q, p) => (p.km_max != null ? q.where(sql`child.km_driven`, "<=", p.km_max) : q),
	part_category: (q, p) =>
		p.part_category ? q.where(sql`child.part_category`, "=", p.part_category) : q,
};

// ─── Search-mode resolution ──────────────────────────────────────────────────

async function resolveListingSearchMode(
	raw: string | null | undefined,
): Promise<ListingSearchMode> {
	if (!raw) {
		return { type: "none" };
	}
	const tsquery = toTsQuery(raw);
	if (!tsquery) {
		return { type: "none" };
	}
	const prefixQuery = toPrefixTsQuery(raw);
	if (!prefixQuery) {
		return { type: "none" };
	}

	try {
		const ftsCheck = await db
			.selectFrom("listing")
			.select(sql<number>`1`.as("hit"))
			.where(sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${prefixQuery})`)
			.where("listing.status", "=", "active")
			.limit(1)
			.executeTakeFirst();

		if (ftsCheck) {
			return { type: "fts", prefixQuery };
		}
	} catch {
		// Malformed tsquery — fall through to trigram
	}

	return { type: "trigram", raw };
}

// ─── Unified filter / sort / cursor ──────────────────────────────────────────

function applyFilters(
	query: AnyQuery,
	params: BrowseSearchParams,
	searchMode: ListingSearchMode,
	category: ListingCategory,
	config: CategoryConfig,
): AnyQuery {
	let q = query.where("listing.status", "=", "active").where("listing.category", "=", category);

	if (searchMode.type === "fts") {
		q = q.where(
			sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${searchMode.prefixQuery})`,
		);
	} else if (searchMode.type === "trigram") {
		q = q.where(sql<SqlBool>`(listing.title || ' ' || listing.description) % ${searchMode.raw}`);
	}

	for (const key of config.supportedFilters) {
		q = FILTER_PREDICATES[key](q, params, config);
	}
	return q;
}

function applySort(
	query: AnyQuery,
	sort: SortMode,
	searchMode: ListingSearchMode,
	config: CategoryConfig,
): AnyQuery {
	if (sort === "relevance" && searchMode.type === "fts") {
		return query
			.orderBy(
				sql`ts_rank_cd(listing.search_vector, to_tsquery('finnish_unaccent', ${searchMode.prefixQuery}))`,
				"desc",
			)
			.orderBy("listing.created_at", "desc");
	}
	if (sort === "relevance" && searchMode.type === "trigram") {
		return query
			.orderBy(
				sql`similarity(listing.title || ' ' || listing.description, ${searchMode.raw})`,
				"desc",
			)
			.orderBy("listing.created_at", "desc");
	}
	if (sort === "price_asc") {
		return query.orderBy(config.priceColumn, "asc").orderBy("listing.id", "asc");
	}
	if (sort === "price_desc") {
		return query.orderBy(config.priceColumn, "desc").orderBy("listing.id", "desc");
	}
	return query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
}

function applyCursor(
	query: AnyQuery,
	cursor: string,
	sort: SortMode,
	config: CategoryConfig,
): AnyQuery {
	const [cursorVal, cursorId] = cursor.split("__");
	if (!cursorVal || !cursorId) {
		return query;
	}

	if (sort === "price_asc") {
		return query.where((eb) =>
			eb.or([
				eb(config.priceColumn, ">", Number(cursorVal)),
				eb.and([
					eb(config.priceColumn, "=", Number(cursorVal)),
					eb("listing.id", ">", cursorId),
				]),
			]),
		);
	}
	if (sort === "price_desc") {
		return query.where((eb) =>
			eb.or([
				eb(config.priceColumn, "<", Number(cursorVal)),
				eb.and([
					eb(config.priceColumn, "=", Number(cursorVal)),
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

// NOTE: For "relevance" sort, the cursor falls back to created_at which may skip
// results with lower relevance but newer timestamps. Acceptable for MVP.
function buildNextCursor(
	listings: Array<Listing & { price_per_day?: number }>,
	sort: SortMode,
): string | null {
	if (listings.length < PAGE_SIZE) {
		return null;
	}
	const last = listings[listings.length - 1];
	if (!last) {
		return null;
	}
	if (sort === "price_asc" || sort === "price_desc") {
		return `${last.price_per_day}__${last.id}`;
	}
	return `${last.created_at.toISOString()}__${last.id}`;
}

// ─── Hydration ───────────────────────────────────────────────────────────────

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

	const makeIds = [
		...new Set(listings.map((l) => l.make_id).filter((id): id is string => id !== null)),
	];
	const modelIds = [
		...new Set(listings.map((l) => l.model_id).filter((id): id is string => id !== null)),
	];

	const [makes, models] = await Promise.all([
		makeIds.length > 0
			? db.selectFrom("motorcycle_make").select(["id", "slug"]).where("id", "in", makeIds).execute()
			: Promise.resolve([]),
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
		makeSlug: l.make_id ? (makeMap.get(l.make_id) ?? null) : null,
		modelName: l.model_id ? (modelMap.get(l.model_id) ?? null) : null,
	}));
}

async function hydrateListings(listings: Listing[]): Promise<ListingWithImages[]> {
	if (listings.length === 0) {
		return [];
	}
	const [withMakeModel, imageMap] = await Promise.all([
		attachMakeModel(listings),
		fetchFirstImages(listings.map((l) => l.id)),
	]);
	return withMakeModel.map((l) => ({ ...l, images: imageMap.get(l.id) ?? [] }));
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function searchForCategory(
	params: BrowseSearchParams,
	category: ListingCategory,
): Promise<SearchResult> {
	const config = CATEGORY_CONFIGS[category];
	const searchMode = await resolveListingSearchMode(params.q);
	const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

	const baseQuery = applyFilters(
		db
			.selectFrom("listing")
			.innerJoin(`${config.childTable} as child`, "child.listing_id", "listing.id") as AnyQuery,
		params,
		searchMode,
		category,
		config,
	);

	const countResult = await baseQuery
		.select(sql<number>`count(*)::int`.as("count"))
		.executeTakeFirstOrThrow();

	let query = baseQuery.selectAll("listing").select(config.priceColumn.as("price_per_day"));
	if (params.cursor) {
		query = applyCursor(query, params.cursor, sort, config);
	}
	query = applySort(query, sort, searchMode, config);
	query = query.limit(PAGE_SIZE);

	const listings = (await query.execute()) as (Listing & { price_per_day: number })[];
	return {
		listings: await hydrateListings(listings),
		nextCursor: buildNextCursor(listings, sort),
		totalCount: countResult.count,
	};
}

export const searchListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "search")])
	.inputValidator((input: BrowseSearchParams & { category: ListingCategory }) => ({
		...input,
		category: categorySchema.parse(input.category),
	}))
	.handler(async ({ data: params }): Promise<SearchResult> => {
		return searchForCategory(params, params.category);
	});

export const getLatestListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "latest")])
	.inputValidator((category: unknown) => categorySchema.parse(category))
	.handler(async ({ data: category }) => {
		const config = CATEGORY_CONFIGS[category];

		const listings = (await (db.selectFrom("listing") as AnyQuery)
			.innerJoin(`${config.childTable} as child`, "child.listing_id", "listing.id")
			.selectAll("listing")
			.select(config.priceColumn.as("price_per_day"))
			.where("listing.status", "=", "active")
			.where("listing.category", "=", category)
			.orderBy("listing.created_at", "desc")
			.limit(6)
			.execute()) as (Listing & { price_per_day: number })[];

		if (listings.length === 0) {
			return [] as ListingWithImages[];
		}
		return hydrateListings(listings);
	});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

If typecheck reports issues around `eb(config.priceColumn, ...)` or `.orderBy(config.priceColumn, ...)` — Kysely accepts `sql<number>` fragments in these positions but may need a wrapper. Inspect the exact error before adapting. The single allowed widening is to add `as unknown as ReferenceExpression<Database, never>` or `.as("price")`-style aliasing at the comparison site. Do not loosen the `FilterPredicate` signature further.

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-search.server.ts
git commit -m "feat: unified category-aware search pipeline in listings-search.server"
```

---

## Task 5: Switch importers and delete `listings-queries.ts`

**Files to modify (one step each):**
- `src/routes/index.tsx`
- `src/routes/pyorat/vuokraus/index.tsx`
- `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`
- `src/routes/pyorat/myynti/index.tsx`
- `src/routes/varaosat/index.tsx`
- `src/routes/varusteet/index.tsx`
- `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`
- `src/routes/omat/index.tsx`
- `src/components/listings/empty-state.tsx`
- `src/components/listings/browse-page.tsx`
- `src/components/listings/listing-detail-shell.tsx`
- `src/lib/listings-detail-route.tsx`
- `src/lib/listings-detail-route.test.ts`

**File to delete:** `src/lib/listings-queries.ts`

- [ ] **Step 1: `src/routes/index.tsx` — split the import into two modules**

Change:
```ts
import { getHomepageStats, getLatestListings } from "~/lib/listings-queries";
```
To:
```ts
import { getLatestListings } from "~/lib/listings-search.server";
import { getHomepageStats } from "~/lib/listings-stats.server";
```

- [ ] **Step 2: `src/routes/pyorat/vuokraus/index.tsx`**

Change:
```ts
import { searchListings } from "~/lib/listings-queries";
```
To:
```ts
import { searchListings } from "~/lib/listings-search.server";
```

- [ ] **Step 3: `src/routes/pyorat/vuokraus/$listingId_.$slug.tsx`**

Change:
```ts
import { getListingAvailability, getListingForDisplay, recordView } from "~/lib/listings-queries";
```
To:
```ts
import {
	getListingAvailability,
	getListingForDisplay,
	recordView,
} from "~/lib/listings-detail.server";
```

- [ ] **Step 4: `src/routes/pyorat/myynti/index.tsx`**

Change:
```ts
import { searchListings } from "~/lib/listings-queries";
```
To:
```ts
import { searchListings } from "~/lib/listings-search.server";
```

- [ ] **Step 5: `src/routes/varaosat/index.tsx`**

Change:
```ts
import { searchListings } from "~/lib/listings-queries";
```
To:
```ts
import { searchListings } from "~/lib/listings-search.server";
```

- [ ] **Step 6: `src/routes/varusteet/index.tsx`**

Change:
```ts
import { searchListings } from "~/lib/listings-queries";
```
To:
```ts
import { searchListings } from "~/lib/listings-search.server";
```

- [ ] **Step 7: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`**

Change:
```ts
import { getListingAvailability, getListingForEdit } from "~/lib/listings-queries";
```
To:
```ts
import { getListingAvailability, getListingForEdit } from "~/lib/listings-detail.server";
```

- [ ] **Step 8: `src/routes/omat/index.tsx`**

Change:
```ts
import { getOwnerListings } from "~/lib/listings-queries";
```
To:
```ts
import { getOwnerListings } from "~/lib/listings-owner.server";
```

- [ ] **Step 9: `src/components/listings/empty-state.tsx`**

Change:
```ts
import { getNeighborRegionCount } from "~/lib/listings-queries";
```
To:
```ts
import { getNeighborRegionCount } from "~/lib/listings-stats.server";
```

- [ ] **Step 10: `src/components/listings/browse-page.tsx` (type-only import)**

Change:
```ts
import type { SearchResult } from "~/lib/listings-queries";
```
To:
```ts
import type { SearchResult } from "~/lib/listings-search.server";
```

- [ ] **Step 11: `src/components/listings/listing-detail-shell.tsx` (type-only)**

Change:
```ts
import type { ListingForDisplay } from "~/lib/listings-queries";
```
To:
```ts
import type { ListingForDisplay } from "~/lib/listings-detail.server";
```

- [ ] **Step 12: `src/lib/listings-detail-route.tsx`**

Change:
```ts
import { getListingForDisplay, type ListingForDisplay, recordView } from "~/lib/listings-queries";
```
To:
```ts
import {
	getListingForDisplay,
	type ListingForDisplay,
	recordView,
} from "~/lib/listings-detail.server";
```

- [ ] **Step 13: `src/lib/listings-detail-route.test.ts` — update the mock target**

Change:
```ts
vi.mock("~/lib/listings-queries", () => ({
```
To:
```ts
vi.mock("~/lib/listings-detail.server", () => ({
```

- [ ] **Step 14: Verify no remaining importers**

Run: `grep -rn "listings-queries" src --include="*.ts" --include="*.tsx"`
Expected: zero matches.

- [ ] **Step 15: Delete the old file**

```bash
git rm src/lib/listings-queries.ts
```

- [ ] **Step 16: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "refactor: switch importers to new listings server modules; delete listings-queries"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run full unit suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: Lint & format**

Run: `pnpm lint:fix && pnpm format:fix`
Expected: No errors. If files were rewritten, commit them:

```bash
git status
git add -A && git commit -m "chore: apply biome lint/format fixes"
```

(Skip the commit if `git status` shows no changes.)

- [ ] **Step 3: Typecheck (final)**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: E2E suite**

Run: `pnpm test:e2e`
Expected: PASS

- [ ] **Step 5: Manual smoke (dev server)**

Run: `pnpm dev`

Visit and verify:
1. `/` (homepage) — hero + latest listings + stats render.
2. `/pyorat/vuokraus` — rental browse renders; apply `?region=uusimaa`; "load more" paginates.
3. `/pyorat/myynti` — sale browse renders; apply `?price_max=5000`.
4. `/varusteet` — gear browse renders; apply `?condition=used`.
5. `/varaosat` — parts browse renders; apply `?make=yamaha`.
6. Open a rental detail page — content renders and availability calendar loads.
7. `/omat` (logged in) — owner dashboard lists own listings.
8. Edit page for one of those listings — `/ilmoitukset/<id>/muokkaa` — loads existing data into the form.

Stop dev server.

- [ ] **Step 6: Final commit (only if uncommitted changes remain)**

```bash
git status
```

Only commit if there are uncommitted changes from verification.
