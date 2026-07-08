import { createServerFn } from "@tanstack/react-start";
import { type SqlBool, sql } from "kysely";
import { eurosToCents } from "~/lib/currency";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toPrefixTsQuery, toTsQuery } from "~/lib/search";
import type { ToriBrowseSearchParams } from "~/lib/tori/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

const PAGE_SIZE = 12;

type SortMode = "relevance" | "price_asc" | "price_desc" | "newest";

export type ToriItemWithImages = Listing & {
	images: ListingImage[];
	price_cents: number;
	condition: string;
};

export interface ToriSearchResult {
	items: ToriItemWithImages[];
	nextCursor: string | null;
	totalCount: number;
}

type SearchMode =
	| { type: "none" }
	| { type: "fts"; prefixQuery: string; raw: string }
	| { type: "trigram"; raw: string };

async function resolveSearchMode(raw: string | null | undefined): Promise<SearchMode> {
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
			.where("listing.status", "in", ["active", "removed"])
			.where("listing.category", "in", ["gear", "part"])
			.limit(1)
			.executeTakeFirst();

		if (ftsCheck) {
			return { type: "fts", prefixQuery, raw };
		}
	} catch {
		// Malformed tsquery — fall through to trigram
	}

	return { type: "trigram", raw };
}

export const searchToriItems = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "tori-search")])
	.inputValidator((input: ToriBrowseSearchParams) => input)
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: search handler with many filter branches
	.handler(async ({ data: params }): Promise<ToriSearchResult> => {
		const db = await getDb();
		const searchMode = await resolveSearchMode(params.q);
		const sort: SortMode = params.sort ?? (searchMode.type !== "none" ? "relevance" : "newest");

		// Base query joins gear/part for price and condition
		let baseQuery = db
			.selectFrom("listing")
			.leftJoin("listing_gear", "listing_gear.listing_id", "listing.id")
			.leftJoin("listing_part", "listing_part.listing_id", "listing.id")
			.where("listing.category", "in", ["gear", "part"])
			.where(
				"listing.status",
				params.hide_sold ? "=" : "in",
				params.hide_sold ? "active" : ["active", "removed"],
			);

		if (searchMode.type === "fts") {
			baseQuery = baseQuery.where(
				sql<SqlBool>`listing.search_vector @@ to_tsquery('finnish_unaccent', ${searchMode.prefixQuery})`,
			);
		} else if (searchMode.type === "trigram") {
			baseQuery = baseQuery.where(
				sql<SqlBool>`(listing.title || ' ' || listing.description) % ${searchMode.raw}`,
			);
		}

		if (params.category) {
			// Map old tori categories to listing categories
			if (params.category === "gear" || params.category === "apparel") {
				baseQuery = baseQuery.where("listing.category", "=", "gear");
			} else {
				baseQuery = baseQuery.where("listing.category", "=", "part");
			}
		}
		if (params.condition) {
			baseQuery = baseQuery.where(
				sql<SqlBool>`coalesce(listing_gear.condition, listing_part.condition) = ${params.condition}`,
			);
		}
		if (params.region) {
			baseQuery = baseQuery.where("listing.region", "=", params.region);
		}
		if (params.price_min != null) {
			baseQuery = baseQuery.where(
				sql<SqlBool>`coalesce(listing_gear.price, listing_part.price) >= ${eurosToCents(params.price_min)}`,
			);
		}
		if (params.price_max != null) {
			baseQuery = baseQuery.where(
				sql<SqlBool>`coalesce(listing_gear.price, listing_part.price) <= ${eurosToCents(params.price_max)}`,
			);
		}

		const countResult = await baseQuery
			.select(sql<number>`count(*)::int`.as("count"))
			.executeTakeFirstOrThrow();

		let query = baseQuery
			.selectAll("listing")
			.select(sql<number>`coalesce(listing_gear.price, listing_part.price)`.as("price_cents"))
			.select(
				sql<string>`coalesce(listing_gear.condition, listing_part.condition)`.as("condition"),
			);

		// Cursor
		if (params.cursor) {
			const [cursorVal, cursorId] = params.cursor.split("__");
			if (cursorVal && cursorId) {
				if (sort === "price_asc") {
					query = query.where(
						sql<SqlBool>`(coalesce(listing_gear.price, listing_part.price), listing.id) > (${Number(cursorVal)}, ${cursorId})`,
					);
				} else if (sort === "price_desc") {
					query = query.where(
						sql<SqlBool>`(coalesce(listing_gear.price, listing_part.price), listing.id) < (${Number(cursorVal)}, ${cursorId})`,
					);
				} else {
					query = query.where((eb) =>
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

		// Sort
		if (sort === "relevance" && searchMode.type === "fts") {
			query = query
				.orderBy(
					sql`ts_rank_cd(listing.search_vector, to_tsquery('finnish_unaccent', ${searchMode.prefixQuery}))`,
					"desc",
				)
				.orderBy("listing.created_at", "desc");
		} else if (sort === "relevance" && searchMode.type === "trigram") {
			query = query
				.orderBy(
					sql`similarity(listing.title || ' ' || listing.description, ${searchMode.raw})`,
					"desc",
				)
				.orderBy("listing.created_at", "desc");
		} else if (sort === "price_asc") {
			query = query
				.orderBy(sql`coalesce(listing_gear.price, listing_part.price)`, "asc")
				.orderBy("listing.id", "asc");
		} else if (sort === "price_desc") {
			query = query
				.orderBy(sql`coalesce(listing_gear.price, listing_part.price)`, "desc")
				.orderBy("listing.id", "desc");
		} else {
			query = query.orderBy("listing.created_at", "desc").orderBy("listing.id", "desc");
		}

		const items = await query.limit(PAGE_SIZE).execute();

		// Fetch images
		const itemIds = items.map((i) => i.id);
		const imageMap = new Map<string, ListingImage[]>();
		if (itemIds.length > 0) {
			const images = await db
				.selectFrom("listing_image")
				.selectAll()
				.where("listing_id", "in", itemIds)
				.where("order", "=", 0)
				.execute();
			for (const img of images) {
				const arr = imageMap.get(img.listing_id) ?? [];
				arr.push(img);
				imageMap.set(img.listing_id, arr);
			}
		}

		// Build cursor
		let nextCursor: string | null = null;
		if (items.length >= PAGE_SIZE) {
			const last = items[items.length - 1];
			if (sort === "price_asc" || sort === "price_desc") {
				nextCursor = `${last.price_cents}__${last.id}`;
			} else {
				nextCursor = `${new Date(last.created_at).toISOString()}__${last.id}`;
			}
		}

		return {
			items: items.map((item) => ({ ...item, images: imageMap.get(item.id) ?? [] })),
			nextCursor,
			totalCount: countResult.count,
		};
	});

export const getToriItemById = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(120, 60, "tori-detail")])
	.inputValidator((input: string) => input)
	.handler(async ({ data: shortId }): Promise<ToriItemWithImages | null> => {
		const db = await getDb();
		const item = await db
			.selectFrom("listing")
			.leftJoin("listing_gear", "listing_gear.listing_id", "listing.id")
			.leftJoin("listing_part", "listing_part.listing_id", "listing.id")
			.selectAll("listing")
			.select(sql<number>`coalesce(listing_gear.price, listing_part.price)`.as("price_cents"))
			.select(sql<string>`coalesce(listing_gear.condition, listing_part.condition)`.as("condition"))
			.where("listing.short_id", "=", shortId)
			.where("listing.category", "in", ["gear", "part"])
			.executeTakeFirst();

		if (!item) {
			return null;
		}

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", item.id)
			.orderBy("order", "asc")
			.execute();

		return { ...item, images };
	});
