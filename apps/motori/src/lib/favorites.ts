import { AppError } from "~/lib/errors";
import { fetchListingImages, listingSummaryQuery } from "~/lib/listings-owner";

const getDb = async () => (await import("~/lib/db/index")).db;

export async function toggleFavorite(
	userId: string,
	listingId: string,
): Promise<{ favorited: boolean }> {
	const db = await getDb();
	const deleted = await db
		.deleteFrom("favorite")
		.where("user_id", "=", userId)
		.where("listing_id", "=", listingId)
		.executeTakeFirst();

	if (Number(deleted.numDeletedRows) > 0) {
		return { favorited: false };
	}

	const listing = await db
		.selectFrom("listing")
		.select("id")
		.where("id", "=", listingId)
		.where("status", "!=", "removed")
		.executeTakeFirst();

	if (!listing) {
		throw new AppError("listing.not_found");
	}

	await db
		.insertInto("favorite")
		.values({ user_id: userId, listing_id: listingId })
		.onConflict((oc) => oc.columns(["user_id", "listing_id"]).doNothing())
		.execute();

	return { favorited: true };
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
	const db = await getDb();
	const rows = await db
		.selectFrom("favorite")
		.select("listing_id")
		.where("user_id", "=", userId)
		.execute();
	return rows.map((r) => r.listing_id);
}

/** Watchlist view: sold/expired stay (their status tells the truth), removed drop out. */
export async function getFavoriteListings(userId: string) {
	const db = await getDb();
	const listings = await listingSummaryQuery(db)
		.innerJoin("favorite", "favorite.listing_id", "listing.id")
		.where("favorite.user_id", "=", userId)
		.where("listing.status", "!=", "removed")
		.orderBy("favorite.created_at", "desc")
		.execute();

	return {
		listings,
		images: await fetchListingImages(
			db,
			listings.map((l) => l.id),
		),
	};
}
