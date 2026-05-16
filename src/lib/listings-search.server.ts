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

	let query: AnyQuery = baseQuery.selectAll("listing").select(config.priceColumn.as("price_per_day"));
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
			.selectAll()
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
