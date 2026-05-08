import { createServerFn } from "@tanstack/react-start";
import { type SelectQueryBuilder, type SqlBool, sql } from "kysely";
import { eurosToCents } from "~/lib/currency";
import type { Database, ToriItem, ToriItemImage } from "~/lib/db/schema";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { toTsQuery } from "~/lib/search";
import type { ToriBrowseSearchParams } from "~/lib/tori/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

const PAGE_SIZE = 12;

type SortMode = "relevance" | "price_asc" | "price_desc" | "newest";
type ToriQuery<O> = SelectQueryBuilder<Database, "tori_item", O>;

export type ToriItemWithImages = ToriItem & { images: ToriItemImage[] };

export interface ToriSearchResult {
	items: ToriItemWithImages[];
	nextCursor: string | null;
	totalCount: number;
}

function applyFilters(
	query: ToriQuery<object>,
	params: ToriBrowseSearchParams,
	tsquery: string | null,
) {
	let q = query.where(
		"tori_item.status",
		params.hide_sold ? "=" : "in",
		params.hide_sold ? "active" : ["active", "sold"],
	);

	if (tsquery) {
		q = q.where(
			sql<SqlBool>`tori_item.search_vector @@ websearch_to_tsquery('finnish_unaccent', ${tsquery})`,
		);
	}
	if (params.category) {
		q = q.where("tori_item.category", "=", params.category);
	}
	if (params.condition) {
		q = q.where("tori_item.condition", "=", params.condition);
	}
	if (params.region) {
		q = q.where("tori_item.region", "=", params.region);
	}
	if (params.price_min != null) {
		q = q.where("tori_item.price_cents", ">=", eurosToCents(params.price_min));
	}
	if (params.price_max != null) {
		q = q.where("tori_item.price_cents", "<=", eurosToCents(params.price_max));
	}
	return q;
}

function applyCursor<O>(query: ToriQuery<O>, cursor: string, sort: SortMode): ToriQuery<O> {
	const [cursorVal, cursorId] = cursor.split("__");
	if (!cursorVal || !cursorId) {
		return query;
	}

	if (sort === "price_asc") {
		return query.where((eb) =>
			eb.or([
				eb("tori_item.price_cents", ">", Number(cursorVal)),
				eb.and([
					eb("tori_item.price_cents", "=", Number(cursorVal)),
					eb("tori_item.id", ">", cursorId),
				]),
			]),
		);
	}
	if (sort === "price_desc") {
		return query.where((eb) =>
			eb.or([
				eb("tori_item.price_cents", "<", Number(cursorVal)),
				eb.and([
					eb("tori_item.price_cents", "=", Number(cursorVal)),
					eb("tori_item.id", "<", cursorId),
				]),
			]),
		);
	}
	return query.where((eb) =>
		eb.or([
			eb("tori_item.created_at", "<", new Date(cursorVal)),
			eb.and([
				eb("tori_item.created_at", "=", new Date(cursorVal)),
				eb("tori_item.id", "<", cursorId),
			]),
		]),
	);
}

function applySort<O>(query: ToriQuery<O>, sort: SortMode, tsquery: string | null): ToriQuery<O> {
	if (sort === "relevance" && tsquery) {
		return query
			.orderBy(
				sql`ts_rank_cd(tori_item.search_vector, websearch_to_tsquery('finnish_unaccent', ${tsquery}))`,
				"desc",
			)
			.orderBy("tori_item.created_at", "desc");
	}
	if (sort === "price_asc") {
		return query.orderBy("tori_item.price_cents", "asc").orderBy("tori_item.id", "asc");
	}
	if (sort === "price_desc") {
		return query.orderBy("tori_item.price_cents", "desc").orderBy("tori_item.id", "desc");
	}
	return query.orderBy("tori_item.created_at", "desc").orderBy("tori_item.id", "desc");
}

function buildNextCursor(items: ToriItem[], sort: SortMode): string | null {
	if (items.length < PAGE_SIZE) {
		return null;
	}
	const last = items[items.length - 1];
	if (sort === "price_asc" || sort === "price_desc") {
		return `${last.price_cents}__${last.id}`;
	}
	return `${new Date(last.created_at).toISOString()}__${last.id}`;
}

async function fetchImages(itemIds: string[]): Promise<Map<string, ToriItemImage[]>> {
	const map = new Map<string, ToriItemImage[]>();
	if (itemIds.length === 0) {
		return map;
	}

	const db = await getDb();
	const images = await db
		.selectFrom("tori_item_image")
		.selectAll()
		.where("item_id", "in", itemIds)
		.where("order", "=", 0)
		.execute();

	for (const img of images) {
		const arr = map.get(img.item_id) ?? [];
		arr.push(img);
		map.set(img.item_id, arr);
	}
	return map;
}

export const searchToriItems = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "tori-search")])
	.inputValidator((input: ToriBrowseSearchParams) => input)
	.handler(async ({ data: params }): Promise<ToriSearchResult> => {
		const db = await getDb();
		const tsquery = params.q ? toTsQuery(params.q) : null;
		const sort: SortMode = params.sort ?? (tsquery ? "relevance" : "newest");

		const baseQuery = applyFilters(db.selectFrom("tori_item"), params, tsquery);

		const countResult = await baseQuery
			.select(sql<number>`count(*)::int`.as("count"))
			.executeTakeFirstOrThrow();

		let query = baseQuery.selectAll("tori_item");
		if (params.cursor) {
			query = applyCursor(query, params.cursor, sort);
		}
		query = applySort(query, sort, tsquery);

		const items = await query.limit(PAGE_SIZE).execute();
		const images = await fetchImages(items.map((i) => i.id));

		return {
			items: items.map((item) => ({ ...item, images: images.get(item.id) ?? [] })),
			nextCursor: buildNextCursor(items, sort),
			totalCount: countResult.count,
		};
	});

export const getToriItemById = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(120, 60, "tori-detail")])
	.inputValidator((input: string) => input)
	.handler(async ({ data: shortId }): Promise<ToriItemWithImages | null> => {
		const db = await getDb();
		const item = await db
			.selectFrom("tori_item")
			.selectAll()
			.where("short_id", "=", shortId)
			.executeTakeFirst();

		if (!item) {
			return null;
		}

		const images = await db
			.selectFrom("tori_item_image")
			.selectAll()
			.where("item_id", "=", item.id)
			.orderBy("order", "asc")
			.execute();

		return { ...item, images };
	});
