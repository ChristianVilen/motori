const getDb = async () => (await import("~/lib/db/index")).db;

import type { Listing, ListingImage } from "~/lib/db/schema";

export type OwnerListingsResult = {
	listings: Array<Listing & { makeSlug: string | null; modelName: string | null }>;
	images: ListingImage[];
};

export async function getOwnerListings(ownerId: string): Promise<OwnerListingsResult> {
	return queryOwnerListings(ownerId, false);
}

/** Public-profile view: active listings only. */
export async function getOwnerActiveListings(ownerId: string): Promise<OwnerListingsResult> {
	return queryOwnerListings(ownerId, true);
}

async function queryOwnerListings(
	ownerId: string,
	activeOnly: boolean,
): Promise<OwnerListingsResult> {
	const db = await getDb();
	const listings = await db
		.selectFrom("listing")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.selectAll("listing")
		.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
		.where("owner_id", "=", ownerId)
		.where("listing.status", activeOnly ? "=" : "!=", activeOnly ? "active" : "removed")
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
