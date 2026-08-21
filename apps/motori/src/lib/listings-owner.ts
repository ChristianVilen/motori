const getDb = async () => (await import("~/lib/db/index")).db;

import { type Kysely, sql } from "kysely";
import type { Condition } from "~/lib/constants";
import type { Database, Listing, ListingImage } from "~/lib/db/schema";

export type ListingSummary = Listing & {
	makeSlug: string | null;
	modelName: string | null;
	price: number | null;
	km_driven: number | null;
	condition: Condition | null;
};

export type OwnerListingsResult = {
	listings: ListingSummary[];
	images: ListingImage[];
};

/** Shared base for card/row collections: listing + make/model labels + cross-category price/facts. */
export function listingSummaryQuery(db: Kysely<Database>) {
	return db
		.selectFrom("listing")
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
			"listing_sale.km_driven",
			sql<Condition | null>`coalesce(listing_sale.condition, listing_gear.condition, listing_part.condition)`.as(
				"condition",
			),
		]);
}

export async function fetchListingImages(
	db: Kysely<Database>,
	listingIds: string[],
): Promise<ListingImage[]> {
	if (listingIds.length === 0) {
		return [];
	}
	return db
		.selectFrom("listing_image")
		.selectAll()
		.where("listing_id", "in", listingIds)
		.orderBy("order", "asc")
		.execute();
}

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
	const listings = await listingSummaryQuery(db)
		.where("owner_id", "=", ownerId)
		.where("listing.status", activeOnly ? "=" : "!=", activeOnly ? "active" : "removed")
		.orderBy("listing.created_at", "desc")
		.execute();

	return {
		listings,
		images: await fetchListingImages(
			db,
			listings.map((l) => l.id),
		),
	};
}
