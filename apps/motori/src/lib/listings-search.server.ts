import { createHmac, randomBytes } from "node:crypto";
import { type Kysely, type RawBuilder, type SqlBool, sql } from "kysely";
import { hasCategoryMap } from "~/lib/constants";
import { eurosToCents } from "~/lib/currency";
import type { Database, ListingImage } from "~/lib/db/schema";
import { listingSummaryQuery } from "~/lib/listings-owner";
import type { SearchCategory, SearchResult } from "~/lib/listings-search";
import { toPrefixTsQuery } from "~/lib/search";
import { type BrowseSearchParams, excludesRentals } from "~/lib/validators";

type SearchInput = BrowseSearchParams & { category: SearchCategory };

// Only a successful page read can issue a larger window. Legacy keyset URLs still start at their cursor.
const cursorKey = process.env.BETTER_AUTH_SECRET || randomBytes(32);

function windowCursor(limit: number, after: string) {
	const signature = createHmac("sha256", cursorKey)
		.update(`listing-window/v1:${limit}:${after}`)
		.digest("base64url");
	return `w1:${limit}:${signature}:${after}`;
}

function visibleWindow(cursor: string | undefined, pageSize: number) {
	if (!cursor?.startsWith("w1:")) {
		return { limit: pageSize, after: cursor ?? "" };
	}
	const match = /^w1:(\d+):[\w-]+:(.*)$/.exec(cursor);
	if (match) {
		const limit = Number(match[1]);
		const after = match[2];
		if (Number.isSafeInteger(limit) && limit > 0 && windowCursor(limit, after) === cursor) {
			return { limit, after };
		}
	}
	return { limit: pageSize, after: "" };
}

function activeListings(db: Kysely<Database>) {
	return db
		.selectFrom(listingSummaryQuery(db).as("card"))
		.where("card.status", "=", "active")
		.where("card.price", "is not", null);
}

type CardsQuery = ReturnType<typeof activeListings>;

function bikeFilters(q: CardsQuery, p: SearchInput) {
	if (p.type?.length) {
		q = q.where("card.motorcycle_type", "in", p.type);
	}
	if (p.license?.length) {
		q = q.where(sql<string>`card.required_license`, "in", p.license);
	}
	if (p.cc_min != null) {
		q = q.where("card.engine_cc", ">=", p.cc_min);
	}
	if (p.cc_max != null) {
		q = q.where("card.engine_cc", "<=", p.cc_max);
	}
	if (p.year_min != null) {
		q = q.where("card.year", ">=", p.year_min);
	}
	if (p.year_max != null) {
		q = q.where("card.year", "<=", p.year_max);
	}
	if (p.category === "sale" && p.km_max != null) {
		q = q.where("card.km_driven", "<=", p.km_max);
	}
	return q;
}

function filteredListings(db: Kysely<Database>, p: SearchInput) {
	let q = activeListings(db);
	if (p.category !== "all") {
		q = q.where("card.category", "=", p.category);
	}
	if (p.region) {
		q = q.where("card.region", "=", p.region);
	}
	if (p.price_min != null) {
		q = q.where("card.price", ">=", eurosToCents(p.price_min));
	}
	if (p.price_max != null) {
		q = q.where("card.price", "<=", eurosToCents(p.price_max));
	}
	if (p.condition && p.category !== "rental") {
		q = q.where("card.condition", "=", p.condition);
	}
	if (p.category === "all") {
		return excludesRentals(p.category, p) ? q.where("card.category", "!=", "rental") : q;
	}
	return categoryFilters(q, p);
}

function categoryFilters(q: CardsQuery, p: SearchInput) {
	if (p.make && p.category !== "gear") {
		q = q.where("card.makeSlug", "=", p.make);
	}
	if (p.category === "part" && p.part_category) {
		q = q.where("card.part_category", "=", p.part_category);
	}
	if (p.category === "gear") {
		if (p.gear_type) {
			q = q.where("card.gear_type", "=", p.gear_type);
		}
		if (p.size) {
			q = q.where("card.size", "=", p.size);
		}
	}
	if (p.category === "sale" || p.category === "rental") {
		return bikeFilters(q, p);
	}
	return q;
}

async function searchExpression(db: Kysely<Database>, text: string) {
	const prefix = toPrefixTsQuery(text);
	if (!prefix) {
		return null;
	}
	const match = sql<SqlBool>`card.search_vector @@ to_tsquery('finnish_unaccent', ${prefix})`;
	const hit = await db
		.selectFrom("listing as card")
		.select("card.id")
		.where("card.status", "=", "active")
		.where(match)
		.limit(1)
		.executeTakeFirst()
		.catch((error: unknown) => {
			// A malformed tsquery can still match the plain-text trigram search.
			if (error instanceof Error && "code" in error && error.code === "42601") {
				return undefined;
			}
			throw error;
		});
	if (hit) {
		return {
			match,
			rank: sql<number>`ts_rank_cd(card.search_vector, to_tsquery('finnish_unaccent', ${prefix}))`,
		};
	}
	return {
		match: sql<SqlBool>`(card.title || ' ' || card.description) % ${text}`,
		rank: sql<number>`similarity(card.title || ' ' || card.description, ${text})`,
	};
}

function sortedPage(
	base: CardsQuery,
	sort: BrowseSearchParams["sort"],
	rank: RawBuilder<number> | undefined,
	cursor: string,
) {
	const priceSort = sort === "price_asc" || sort === "price_desc";
	const direction = sort === "price_asc" ? "asc" : "desc";
	const time = sql`card.created_at`;
	const keys = priceSort ? [sql`card.price`] : rank ? [rank, time] : [time];
	keys.push(sql`card.id`);
	let page = base.selectAll("card");
	const values = cursor.split("__");
	const valid = values.length === keys.length && validCursor(values, priceSort, !!rank);
	if (valid) {
		const params = values.map((v, i) => (i === 0 && (priceSort || rank) ? Number(v) : v));
		const op = direction === "asc" ? sql`>` : sql`<`;
		page = page.where(sql<SqlBool>`(${sql.join(keys)}) ${op} (${sql.join(params)})`);
	}
	for (const key of keys) {
		page = page.orderBy(key, direction);
	}
	return { page, start: valid ? cursor : "" };
}

function validCursor(parts: string[], priceSort: boolean, ranked: boolean) {
	const id = parts.at(-1) ?? "";
	if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
		return false;
	}
	if ((priceSort || ranked) && !Number.isFinite(Number(parts[0]))) {
		return false;
	}
	return priceSort || Number.isFinite(Date.parse(parts.at(-2) ?? ""));
}

async function getCoverImages(db: Kysely<Database>, ids: string[]) {
	const images = new Map<string, ListingImage[]>();
	// Bound the number of SQL parameters even on a deeply expanded feed.
	const batchSize = 1000;
	for (let start = 0; start < ids.length; start += batchSize) {
		const rows = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "in", ids.slice(start, start + batchSize))
			.where("order", "=", 0)
			.execute();
		for (const row of rows) {
			images.set(row.listing_id, [row]);
		}
	}
	return images;
}

async function countResults(base: CardsQuery, map: boolean, city?: string) {
	if (map) {
		const mapCities = await base
			.select("card.city")
			.select(sql<number>`count(*)::int`.as("count"))
			.groupBy("card.city")
			.execute();
		const totalCount = city
			? (mapCities.find((row) => row.city === city)?.count ?? 0)
			: mapCities.reduce((sum, row) => sum + row.count, 0);
		return { totalCount, mapCities };
	}
	const count = await base.select((eb) => eb.fn.countAll().as("count")).executeTakeFirstOrThrow();
	return { totalCount: Number(count.count) };
}

export async function searchListingFeed(db: Kysely<Database>, p: SearchInput) {
	// A rejected tsquery must finish before the snapshot begins so the trigram fallback can run.
	const search = p.q ? await searchExpression(db, p.q) : null;
	return db
		.transaction()
		.setIsolationLevel("repeatable read")
		.execute((trx) => searchListingPage(trx, p, 12, search));
}

export async function searchListingPage(
	db: Kysely<Database>,
	p: SearchInput,
	pageSize: number,
	search: Awaited<ReturnType<typeof searchExpression>> = null,
): Promise<SearchResult> {
	let base = filteredListings(db, p);
	if (search) {
		base = base.where(search.match);
	}
	const map = p.view === "map" && hasCategoryMap(p.category);
	const filtered =
		p.city && (map || !hasCategoryMap(p.category)) ? base.where("card.city", "=", p.city) : base;
	const sort = p.sort ?? (search && p.category !== "all" ? "relevance" : "newest");
	const { limit, after } = visibleWindow(p.cursor, pageSize);
	const { page, start } = sortedPage(
		filtered,
		sort,
		sort === "relevance" ? search?.rank : undefined,
		after,
	);
	const rows = map && !p.city ? [] : await page.limit(limit + 1).execute();
	const count = await countResults(map ? base : filtered, map, p.city);
	const listings = rows.slice(0, limit);
	const nextCursor = rows.length > limit ? windowCursor(limit + pageSize, start) : null;
	const images = await getCoverImages(
		db,
		listings.map((l) => l.id),
	);
	return {
		listings: listings.map((listing) => ({
			...listing,
			images: images.get(listing.id) ?? [],
		})),
		nextCursor,
		...count,
	};
}
