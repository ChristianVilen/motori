import { createServerFn } from "@tanstack/react-start";
import { type SelectQueryBuilder, type SqlBool, sql } from "kysely";
import { expandDateRange } from "~/lib/bookings";
import { ADJACENT_REGIONS } from "~/lib/constants";
import { centsToEuros, eurosToCents } from "~/lib/currency";
import type { Database, Listing, ListingImage } from "~/lib/db/schema";

// Lazy-import db so this module is safe to evaluate in client bundles.
// db/index.ts imports pg which uses Buffer (Node-only); keeping it out of the
// static import graph prevents it from being bundled into client chunks.
const getDb = async () => (await import("~/lib/db/index")).db;

import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toTsQuery } from "~/lib/search";
import { generateShortId } from "~/lib/slug";
import type { BrowseSearchParams, ListingFormData } from "~/lib/validators";

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

	const makeIds = [...new Set(listings.map((l) => l.make_id))];
	const modelIds = [
		...new Set(listings.map((l) => l.model_id).filter((id): id is string => id !== null)),
	];

	const db = await getDb();
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

function applyFilters(
	query: SelectQueryBuilder<Database, "listing", object>,
	params: BrowseSearchParams,
	tsquery: string | null,
) {
	let q = query.where("listing.status", "=", "active");

	if (tsquery) {
		q = q.where(
			sql<SqlBool>`listing.search_vector @@ websearch_to_tsquery('finnish_unaccent', ${tsquery})`,
		);
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
		q = q.where("listing.price_per_day", ">=", eurosToCents(params.price_min));
	}
	if (params.price_max != null) {
		q = q.where("listing.price_per_day", "<=", eurosToCents(params.price_max));
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

export const searchListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "search")])
	.inputValidator((input: BrowseSearchParams) => input)
	.handler(async ({ data: params }): Promise<SearchResult> => {
		const db = await getDb();
		const tsquery = params.q ? toTsQuery(params.q) : null;
		const sort: SortMode = params.sort ?? (tsquery ? "relevance" : "newest");

		const baseQuery = applyFilters(db.selectFrom("listing"), params, tsquery);

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
	const db = await getDb();
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
	const db = await getDb();
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
		minPricePerDay: Math.round(centsToEuros(result.min_price)),
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
				.selectFrom("listing")
				.select(["availability_default"])
				.where("id", "=", listingId)
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
	images: ListingImage[];
	makeName: string | null;
	makeSlug: string | null;
	modelName: string | null;
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

	if (!row) {
		return null;
	}

	const { makeName, makeSlug, modelName, ...listing } = row;

	const images = await db
		.selectFrom("listing_image")
		.selectAll()
		.where("listing_id", "=", listing.id)
		.orderBy("order", "asc")
		.execute();

	return {
		listing,
		images,
		makeName: makeName ?? null,
		makeSlug: makeSlug ?? null,
		modelName: modelName ?? null,
	};
}

export type ListingForEdit = {
	listing: Listing;
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
};

export async function getListingForEdit(shortId: string): Promise<ListingForEdit | null> {
	const db = await getDb();
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

	const images = await db
		.selectFrom("listing_image")
		.selectAll()
		.where("listing_id", "=", listing.id)
		.orderBy("order", "asc")
		.execute();

	return {
		listing,
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

export type CreateListingResult = {
	id: string;
	shortId: string;
	makeSlug: string | null;
	modelName: string | null;
	city: string;
};

export async function createListing(
	ownerId: string,
	data: ListingFormData,
): Promise<CreateListingResult> {
	const db = await getDb();
	const id = crypto.randomUUID();
	const shortId = generateShortId();
	const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

	await db
		.insertInto("listing")
		.values({
			id,
			short_id: shortId,
			owner_id: ownerId,
			title: data.title,
			make_id: data.make_id,
			model_id: data.model_id ?? null,
			year: data.year,
			engine_cc: data.engine_cc ?? null,
			required_license: data.required_license ?? null,
			motorcycle_type: data.motorcycle_type,
			price_per_day: eurosToCents(data.price_per_day),
			price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
			price_per_weekend: data.price_per_weekend ? eurosToCents(data.price_per_weekend) : null,
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

	const [make, model] = await Promise.all([
		db
			.selectFrom("motorcycle_make")
			.select(["slug"])
			.where("id", "=", data.make_id)
			.executeTakeFirst(),
		data.model_id
			? db
					.selectFrom("motorcycle_model")
					.select(["name"])
					.where("id", "=", data.model_id)
					.executeTakeFirst()
			: Promise.resolve(null),
	]);

	return {
		id,
		shortId,
		makeSlug: make?.slug ?? null,
		modelName: model?.name ?? null,
		city: data.city,
	};
}

export async function updateListing(
	id: string,
	ownerId: string,
	data: ListingFormData,
): Promise<void> {
	const db = await getDb();
	const existing = await db
		.selectFrom("listing")
		.select(["owner_id"])
		.where("id", "=", id)
		.executeTakeFirst();

	if (!existing) {
		throw new Error("Ilmoitusta ei löydy");
	}
	if (existing.owner_id !== ownerId) {
		throw new Error("Ei oikeuksia");
	}

	await db.transaction().execute(async (trx) => {
		await trx
			.updateTable("listing")
			.set({
				title: data.title,
				make_id: data.make_id,
				model_id: data.model_id ?? null,
				year: data.year,
				engine_cc: data.engine_cc ?? null,
				required_license: data.required_license ?? null,
				motorcycle_type: data.motorcycle_type,
				price_per_day: eurosToCents(data.price_per_day),
				price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
				price_per_weekend: data.price_per_weekend ? eurosToCents(data.price_per_weekend) : null,
				price_description: data.price_description ?? null,
				city: data.city,
				region: data.region,
				postal_code: data.postal_code ?? null,
				description: data.description,
				mileage_limit: data.mileage_limit ?? null,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await trx.deleteFrom("listing_image").where("listing_id", "=", id).execute();

		if (data.images.length > 0) {
			await trx
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
	});
}

export async function setListingStatus(
	id: string,
	ownerId: string,
	status: "active" | "paused" | "removed",
): Promise<void> {
	const db = await getDb();
	const listing = await db
		.selectFrom("listing")
		.select(["owner_id"])
		.where("id", "=", id)
		.executeTakeFirst();

	if (!listing || listing.owner_id !== ownerId) {
		throw new Error("Ei oikeuksia");
	}

	await db
		.updateTable("listing")
		.set({ status, updated_at: new Date() })
		.where("id", "=", id)
		.execute();
}
