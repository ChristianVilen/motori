import { createServerFn } from "@tanstack/react-start";
import { type SelectQueryBuilder, type SqlBool, sql } from "kysely";
import { expandDateRange } from "~/lib/bookings";
import { centsToEuros, eurosToCents } from "~/lib/currency";
import type { Database, Listing, ListingImage } from "~/lib/db/schema";
import type { ListingCategory } from "~/lib/db/schema";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toPrefixTsQuery, toTsQuery } from "~/lib/search";
import type { BrowseSearchParams } from "~/lib/validators";

// Lazy-import db so this module is safe to evaluate in client bundles.
// db/index.ts imports pg which uses Buffer (Node-only); keeping it out of the
// static import graph prevents it from being bundled into client chunks.
const getDb = async () => (await import("~/lib/db/index")).db;

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

type ListingQuery<O> = SelectQueryBuilder<Database, "listing" | "listing_rental", O>;

function applyCursor<O>(query: ListingQuery<O>, cursor: string, sort: SortMode): ListingQuery<O> {
	const [cursorVal, cursorId] = cursor.split("__");
	if (!cursorVal || !cursorId) {
		return query;
	}

	if (sort === "price_asc") {
		return query.where((eb) =>
			eb.or([
				eb("listing_rental.price_per_day", ">", Number(cursorVal)),
				eb.and([
					eb("listing_rental.price_per_day", "=", Number(cursorVal)),
					eb("listing.id", ">", cursorId),
				]),
			]),
		);
	}
	if (sort === "price_desc") {
		return query.where((eb) =>
			eb.or([
				eb("listing_rental.price_per_day", "<", Number(cursorVal)),
				eb.and([
					eb("listing_rental.price_per_day", "=", Number(cursorVal)),
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

type ListingSearchMode =
	| { type: "none" }
	| { type: "fts"; prefixQuery: string }
	| { type: "trigram"; raw: string };

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

	const db = await getDb();
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
		// Malformed tsquery (e.g. special characters) — fall through to trigram
	}

	return { type: "trigram", raw };
}

function applySort<O>(
	query: ListingQuery<O>,
	sort: SortMode,
	searchMode: ListingSearchMode,
): ListingQuery<O> {
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
		return query.orderBy("listing_rental.price_per_day", "asc").orderBy("listing.id", "asc");
	}
	if (sort === "price_desc") {
		return query.orderBy("listing_rental.price_per_day", "desc").orderBy("listing.id", "desc");
	}
	return query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
}

async function fetchFirstImages(listingIds: string[]): Promise<Map<string, ListingImage[]>> {
	const imageMap = new Map<string, ListingImage[]>();
	if (listingIds.length === 0) {
		return imageMap;
	}

	const db = await getDb();
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

	const db = await getDb();
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

// NOTE: For "relevance" sort, the cursor falls back to created_at which may skip
// results with lower relevance but newer timestamps. Acceptable for MVP since most
// users won't page deep through relevance results. A proper fix would require
// encoding the rank score into the cursor or using offset-based pagination for relevance.
function buildNextCursor(
	listings: Array<Listing & { price_per_day?: number }>,
	sort: SortMode,
): string | null {
	if (listings.length < PAGE_SIZE) {
		return null;
	}
	const last = listings[listings.length - 1];
	if (sort === "price_asc" || sort === "price_desc") {
		return `${last.price_per_day ?? 0}__${last.id}`;
	}
	return `${new Date(last.created_at).toISOString()}__${last.id}`;
}

function applyFilters(
	query: SelectQueryBuilder<Database, "listing" | "listing_rental", object>,
	params: BrowseSearchParams,
	searchMode: ListingSearchMode,
) {
	let q = query.where("listing.status", "=", "active");

	if (searchMode.type === "fts") {
		q = q.where(
			sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${searchMode.prefixQuery})`,
		);
	} else if (searchMode.type === "trigram") {
		q = q.where(sql<SqlBool>`(listing.title || ' ' || listing.description) % ${searchMode.raw}`);
	}
	if (params.region) {
		q = q.where("listing.region", "=", params.region);
	}
	if (params.type?.length) {
		q = q.where("listing.motorcycle_type", "in", params.type);
	}
	if (params.license?.length) {
		q = q.where("listing.required_license", "in", params.license as ("A1" | "A2" | "A")[]);
	}
	if (params.price_min != null) {
		q = q.where("listing_rental.price_per_day", ">=", eurosToCents(params.price_min));
	}
	if (params.price_max != null) {
		q = q.where("listing_rental.price_per_day", "<=", eurosToCents(params.price_max));
	}
	if (params.cc_min != null) {
		q = q.where("listing.engine_cc", ">=", params.cc_min);
	}
	if (params.cc_max != null) {
		q = q.where("listing.engine_cc", "<=", params.cc_max);
	}
	if (params.year_min != null) {
		q = q.where("listing.year", ">=", params.year_min);
	}
	if (params.year_max != null) {
		q = q.where("listing.year", "<=", params.year_max);
	}
	if (params.make) {
		q = q
			.innerJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.where("motorcycle_make.slug", "=", params.make);
	}
	return q;
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

// ─── Exported server functions ───────────────────────────────────────────────

export const searchListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "search")])
	.inputValidator((input: BrowseSearchParams & { category: ListingCategory }) => input)
	.handler(async ({ data: params }): Promise<SearchResult> => {
		if (params.category === "rental") {
			return searchRentalListings(params);
		}
		return searchSimpleListings(params as BrowseSearchParams & { category: "sale" | "gear" | "part" });
	});

async function searchRentalListings(params: BrowseSearchParams): Promise<SearchResult> {
	const db = await getDb();
	const searchMode = await resolveListingSearchMode(params.q);
	const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

	const baseQuery = applyFilters(
		db
			.selectFrom("listing")
			.innerJoin("listing_rental", "listing_rental.listing_id", "listing.id")
			.where("listing.category", "=", "rental"),
		params,
		searchMode,
	);

	const countResult = await baseQuery
		.select(sql<number>`count(*)::int`.as("count"))
		.executeTakeFirstOrThrow();

	let query = baseQuery.selectAll("listing").select("listing_rental.price_per_day");
	if (params.cursor) query = applyCursor(query, params.cursor, sort);
	query = applySort(query, sort, searchMode);
	query = query.limit(PAGE_SIZE);

	const listings = await query.execute();
	return {
		listings: await hydrateListings(listings),
		nextCursor: buildNextCursor(listings, sort),
		totalCount: countResult.count,
	};
}

async function searchSimpleListings(
	params: BrowseSearchParams & { category: "sale" | "gear" | "part" },
): Promise<SearchResult> {
	const db = await getDb();
	const searchMode = await resolveListingSearchMode(params.q);
	const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

	const childTable =
		params.category === "sale"
			? "listing_sale"
			: params.category === "gear"
				? "listing_gear"
				: "listing_part";

	// biome-ignore lint/suspicious/noExplicitAny: dynamic join table name
	let base: any = (
		db
			.selectFrom("listing")
			.innerJoin(`${childTable} as child` as any, "child.listing_id" as any, "listing.id") as any
	)
		.where("listing.category", "=", params.category)
		.where("listing.status", "=", "active");

	if (searchMode.type === "fts") {
		base = base.where(
			sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${searchMode.prefixQuery})`,
		);
	} else if (searchMode.type === "trigram") {
		base = base.where(
			sql<SqlBool>`(listing.title || ' ' || listing.description) % ${searchMode.raw}`,
		);
	}
	if (params.region) base = base.where("listing.region", "=", params.region);
	if (params.price_min != null)
		base = base.where(sql`child.price` as any, ">=", eurosToCents(params.price_min));
	if (params.price_max != null)
		base = base.where(sql`child.price` as any, "<=", eurosToCents(params.price_max));
	if (params.condition)
		base = base.where(sql`child.condition` as any, "=", params.condition);
	if (params.gear_type && params.category === "gear")
		base = base.where(sql`child.gear_type` as any, "=", params.gear_type);
	if (params.make && (params.category === "sale" || params.category === "part")) {
		base = base
			.innerJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.where("motorcycle_make.slug", "=", params.make);
	}

	const countResult = await (base as any)
		.select(sql<number>`count(*)::int`.as("count"))
		.executeTakeFirstOrThrow();

	let query = (base as any)
		.selectAll("listing")
		.select(sql<number>`child.price`.as("price_per_day")); // alias for cursor compat

	if (params.cursor) {
		const [cursorVal, cursorId] = params.cursor.split("__");
		if (cursorVal && cursorId) {
			if (sort === "price_asc") {
				query = query.where((eb: any) =>
					eb.or([
						eb(sql`child.price`, ">", Number(cursorVal)),
						eb.and([eb(sql`child.price`, "=", Number(cursorVal)), eb("listing.id", ">", cursorId)]),
					]),
				);
			} else if (sort === "price_desc") {
				query = query.where((eb: any) =>
					eb.or([
						eb(sql`child.price`, "<", Number(cursorVal)),
						eb.and([eb(sql`child.price`, "=", Number(cursorVal)), eb("listing.id", "<", cursorId)]),
					]),
				);
			} else {
				query = query.where((eb: any) =>
					eb.or([
						eb("listing.created_at", "<", new Date(cursorVal)),
						eb.and([
							eb("listing.created_at", "=", new Date(cursorVal)),
							eb("listing.id", "<", cursorId),
						]),
					]),
				);
			}
		}
	}

	if (sort === "price_asc") {
		query = query.orderBy(sql`child.price`, "asc").orderBy("listing.id", "asc");
	} else if (sort === "price_desc") {
		query = query.orderBy(sql`child.price`, "desc").orderBy("listing.id", "desc");
	} else {
		query = query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
	}
	query = query.limit(PAGE_SIZE);

	const listings = await query.execute();
	return {
		listings: await hydrateListings(listings),
		nextCursor: buildNextCursor(listings, sort),
		totalCount: countResult.count,
	};
}

export const getLatestListings = createServerFn({ method: "GET" })
	.inputValidator((category: ListingCategory) => category)
	.handler(async ({ data: category }) => {
		const db = await getDb();
		const listings = await db
			.selectFrom("listing")
			.selectAll()
			.where("status", "=", "active")
			.where("category", "=", category)
			.orderBy("created_at", "desc")
			.limit(6)
			.execute();

		if (listings.length === 0) return [] as ListingWithImages[];
		return hydrateListings(listings);
	});

export const getHomepageStats = createServerFn({ method: "GET" }).handler(async () => {
	const db = await getDb();
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

		const db = await getDb();
		const result = await db
			.selectFrom("listing")
			.select(sql<number>`count(*)::int`.as("count"))
			.where("status", "=", "active")
			.where("region", "in", neighbors)
			.executeTakeFirstOrThrow();

		return result.count;
	});

export const getListingAvailability = createServerFn({ method: "GET" })
	.inputValidator((listingId: string) => listingId)
	.handler(async ({ data: listingId }) => {
		const db = await getDb();
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

// ─── Module functions ────────────────────────────────────────────────────────

// In-memory dedup for view count increments (per-process, 60s TTL, 10k cap)
const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

// updated_at intentionally omitted — view bumps should not surface listings
// as "recently updated" in sorting or the sitemap lastmod.
export function recordView(shortId: string, viewerId: string | undefined, ip: string): void {
	const dedupKey = viewerId ? `view:${shortId}:${viewerId}` : `view:${shortId}:${ip}`;
	if (viewedRecently.size < VIEW_DEDUP_MAX && viewedRecently.has(dedupKey)) {
		return;
	}
	if (viewedRecently.size < VIEW_DEDUP_MAX) {
		viewedRecently.add(dedupKey);
		setTimeout(() => viewedRecently.delete(dedupKey), 60_000);
	}
	void getDb().then((db) =>
		db
			.updateTable("listing")
			.set({ view_count: sql`view_count + 1` })
			.where("short_id", "=", shortId)
			.execute()
			.catch(() => {}),
	);
}

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
	makeName: string | null;
	makeSlug: string | null;
	modelName: string | null;
	ownerContact: { phone: string | null; showPhone: boolean };
};

export async function getListingForDisplay(shortId: string): Promise<ListingForDisplay | null> {
	const db = await getDb();
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

	if (!row) return null;
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
					.select(["part_category", "compatible_make_id", "compatible_model_id", "condition", "price"])
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
	const db = await getDb();
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
					.select(["part_category", "compatible_make_id", "compatible_model_id", "condition", "price"])
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

export type OwnerListingsResult = {
	listings: Array<Listing & { makeSlug: string | null; modelName: string | null }>;
	images: ListingImage[];
};

export async function getOwnerListings(ownerId: string): Promise<OwnerListingsResult> {
	const db = await getDb();
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
