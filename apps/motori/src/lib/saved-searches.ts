import type { ListingCategory, SavedSearch } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import type { SavedSearchParams } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

const SAVED_SEARCH_LIMIT = 20;

// Postgres jsonb doesn't preserve key order (it normalizes by key length then
// bytewise), so a row read back from the DB can have different key order than
// fresh Zod output for the same logical filter set. Sort keys before comparing.
// This only canonicalizes top-level keys — the replacer array is a flat allow-list
// applied at every level, so a nested object's keys would be silently dropped.
// Fine today since params is flat; an object-valued field would need a recursive
// canonicalizer.
const canonicalParams = (params: SavedSearchParams): string =>
	JSON.stringify(params, Object.keys(params).sort());

export async function saveSearch(
	userId: string,
	category: ListingCategory,
	params: SavedSearchParams,
): Promise<string> {
	const db = await getDb();
	const existing = await db
		.selectFrom("saved_search")
		.select(["id", "category", "params"])
		.where("user_id", "=", userId)
		.execute();

	const targetParams = canonicalParams(params);
	const duplicate = existing.find(
		(row) => row.category === category && canonicalParams(row.params) === targetParams,
	);
	if (duplicate) {
		return duplicate.id;
	}

	if (existing.length >= SAVED_SEARCH_LIMIT) {
		throw new AppError("saved_search.limit_reached");
	}

	const id = crypto.randomUUID();
	await db.insertInto("saved_search").values({ id, user_id: userId, category, params }).execute();
	return id;
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
	const db = await getDb();
	await db.deleteFrom("saved_search").where("user_id", "=", userId).where("id", "=", id).execute();
}

export async function getSavedSearches(userId: string): Promise<SavedSearch[]> {
	const db = await getDb();
	return db
		.selectFrom("saved_search")
		.selectAll()
		.where("user_id", "=", userId)
		.orderBy("created_at", "desc")
		.execute();
}
