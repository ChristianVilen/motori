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

export type ListingWithImages = Listing & { images: ListingImage[] };

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

		// --- Build the filtered base query ---
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

		const imageMap = await fetchFirstImages(listings.map((l) => l.id));
		const listingsWithImages: ListingWithImages[] = listings.map((l) => ({
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
		return [];
	}

	const imageMap = await fetchFirstImages(listings.map((l) => l.id));
	return listings.map((l) => ({
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
	.inputValidator((region: string) => region)
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
