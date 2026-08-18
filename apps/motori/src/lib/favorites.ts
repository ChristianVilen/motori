import { sql } from "kysely";
import { AppError } from "~/lib/errors";

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
	const listings = await db
		.selectFrom("favorite")
		.innerJoin("listing", "listing.id", "favorite.listing_id")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.leftJoin("listing_sale", "listing_sale.listing_id", "listing.id")
		.leftJoin("listing_gear", "listing_gear.listing_id", "listing.id")
		.leftJoin("listing_part", "listing_part.listing_id", "listing.id")
		.leftJoin("listing_rental", "listing_rental.listing_id", "listing.id")
		.selectAll("listing")
		.select([
			"motorcycle_make.slug as makeSlug",
			"motorcycle_model.name as modelName",
			sql<
				number | null
			>`coalesce(listing_sale.price, listing_gear.price, listing_part.price, listing_rental.price_per_day)`.as(
				"price",
			),
		])
		.where("favorite.user_id", "=", userId)
		.where("listing.status", "!=", "removed")
		.orderBy("favorite.created_at", "desc")
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
