import { type Kysely, type RawBuilder, type SqlBool, sql } from "kysely";
import { eurosToCents } from "~/lib/currency";
import type { Database, ListingImage } from "~/lib/db/schema";
import { listingSummaryQuery } from "~/lib/listings-owner";
import type { SearchCategory, SearchResult } from "~/lib/listings-search";
import { toPrefixTsQuery } from "~/lib/search";
import type { BrowseSearchParams } from "~/lib/validators";

type SearchInput = BrowseSearchParams & { category: SearchCategory };

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
		return p.city ? q.where("card.city", "=", p.city) : q;
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
	cursor?: string,
) {
	const priceSort = sort === "price_asc" || sort === "price_desc";
	const direction = sort === "price_asc" ? "asc" : "desc";
	const time = sql`card.created_at`;
	const keys = priceSort ? [sql`card.price`] : rank ? [rank, time] : [time];
	keys.push(sql`card.id`);
	// Keep PostgreSQL's timestamp precision in the cursor, including ties within a millisecond.
	const cursorColumn = sql.join(
		keys.map((key) => sql`cast(${key} as text)`),
		sql` || '__' || `,
	);
	let page = base.selectAll("card").select(sql<string>`${cursorColumn}`.as("nextKey"));
	const values = cursor?.split("__");
	if (values?.length === keys.length && validCursor(values, priceSort, !!rank)) {
		const params = values.map((v, i) => (i === 0 && (priceSort || rank) ? Number(v) : v));
		const op = direction === "asc" ? sql`>` : sql`<`;
		page = page.where(sql<SqlBool>`(${sql.join(keys)}) ${op} (${sql.join(params)})`);
	}
	for (const key of keys) {
		page = page.orderBy(key, direction);
	}
	return page;
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

export async function searchListingPage(
	db: Kysely<Database>,
	p: SearchInput,
	pageSize = 12,
): Promise<SearchResult> {
	const search = p.q ? await searchExpression(db, p.q) : null;
	let base = filteredListings(db, p);
	if (search) {
		base = base.where(search.match);
	}
	const sort = p.sort ?? (search && p.category !== "all" ? "relevance" : "newest");
	const page = sortedPage(base, sort, sort === "relevance" ? search?.rank : undefined, p.cursor);
	const [rows, count] = await Promise.all([
		page.limit(pageSize + 1).execute(),
		base.select((eb) => eb.fn.countAll().as("count")).executeTakeFirstOrThrow(),
	]);
	const hasMore = rows.length > pageSize;
	const listings = rows.slice(0, pageSize);
	const last = listings.at(-1);
	const nextCursor = hasMore ? (last?.nextKey ?? null) : null;
	const images = new Map<string, ListingImage[]>();
	if (listings.length) {
		for (const img of await db
			.selectFrom("listing_image")
			.selectAll()
			.where(
				"listing_id",
				"in",
				listings.map((l) => l.id),
			)
			.where("order", "=", 0)
			.execute()) {
			images.set(img.listing_id, [img]);
		}
	}
	return {
		listings: listings.map(({ nextKey, ...listing }) => ({
			...listing,
			images: images.get(listing.id) ?? [],
		})),
		nextCursor,
		totalCount: Number(count.count),
	};
}
