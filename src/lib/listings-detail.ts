import { createServerFn } from "@tanstack/react-start";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { expandDateRange } from "~/lib/bookings";
import type {
	Database,
	Listing,
	ListingGear,
	ListingImage,
	ListingPart,
	ListingRental,
	ListingSale,
} from "~/lib/db/schema";

const getDb = async () => (await import("~/lib/db/index")).db;

export type ListingForDisplay = {
	listing: Listing;
	rental: ListingRental | null;
	sale: ListingSale | null;
	gear: ListingGear | null;
	part: ListingPart | null;
	images: ListingImage[];
	makeName: string | null;
	makeSlug: string | null;
	modelName: string | null;
	ownerName: string | null;
	ownerCity: string | null;
	ownerContact: { phone: string | null; showPhone: boolean };
};

type ListingChildren = {
	images: ListingImage[];
	rental: ListingRental | null;
	sale: ListingSale | null;
	gear: ListingGear | null;
	part: ListingPart | null;
};

const orNull = <T>(p: Promise<T | undefined>): Promise<T | null> => p.then((row) => row ?? null);

// Images plus the single populated child table for this listing's category.
// Only the matching child query fires; the others resolve to null without a round-trip.
// (selectFrom needs a literal table name to type the row, so the four cases stay inline.)
async function fetchListingChildren(
	db: Kysely<Database>,
	listing: { id: string; category: string },
): Promise<ListingChildren> {
	const [images, rental, sale, gear, part] = await Promise.all([
		db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute(),
		listing.category === "rental"
			? orNull(
					db
						.selectFrom("listing_rental")
						.selectAll()
						.where("listing_id", "=", listing.id)
						.executeTakeFirst(),
				)
			: null,
		listing.category === "sale"
			? orNull(
					db
						.selectFrom("listing_sale")
						.selectAll()
						.where("listing_id", "=", listing.id)
						.executeTakeFirst(),
				)
			: null,
		listing.category === "gear"
			? orNull(
					db
						.selectFrom("listing_gear")
						.selectAll()
						.where("listing_id", "=", listing.id)
						.executeTakeFirst(),
				)
			: null,
		listing.category === "part"
			? orNull(
					db
						.selectFrom("listing_part")
						.selectAll()
						.where("listing_id", "=", listing.id)
						.executeTakeFirst(),
				)
			: null,
	]);
	return { images, rental, sale, gear, part };
}

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

	const [children, ownerProfile] = await Promise.all([
		fetchListingChildren(db, listing),
		db
			.selectFrom("profile")
			.select(["display_name", "city", "phone", "show_phone"])
			.where("user_id", "=", listing.owner_id)
			.executeTakeFirst(),
	]);

	return {
		listing,
		...children,
		makeName: makeName ?? null,
		makeSlug: makeSlug ?? null,
		modelName: modelName ?? null,
		ownerName: ownerProfile?.display_name ?? null,
		ownerCity: ownerProfile?.city ?? null,
		ownerContact: {
			phone: ownerProfile?.phone ?? null,
			showPhone: ownerProfile?.show_phone ?? false,
		},
	};
}

export type ListingForEdit = {
	listing: Listing;
	rental: ListingRental | null;
	sale: ListingSale | null;
	gear: ListingGear | null;
	part: ListingPart | null;
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
};

export async function getListingForEdit(
	shortId: string,
	ownerId: string,
): Promise<ListingForEdit | null> {
	const db = await getDb();
	const row = await db
		.selectFrom("listing")
		.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
		.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
		.selectAll("listing")
		.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
		.where("listing.short_id", "=", shortId)
		.where("listing.owner_id", "=", ownerId)
		.executeTakeFirst();

	if (!row) {
		return null;
	}

	const { makeSlug, modelName, ...listing } = row;
	const children = await fetchListingChildren(db, listing);

	return {
		listing,
		...children,
		makeSlug: makeSlug ?? null,
		modelName: modelName ?? null,
	};
}

export const getListingAvailability = createServerFn({ method: "GET" })
	.inputValidator((listingId: string) => listingId)
	.handler(async ({ data: listingId }) => {
		const db = await getDb();
		const [listing, exceptions, confirmed] = await Promise.all([
			db
				.selectFrom("listing_rental")
				.select(["availability_default"])
				.where("listing_id", "=", listingId)
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

const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

export function recordView(shortId: string, viewerId: string | undefined, ip: string): void {
	const dedupKey = viewerId ? `view:${shortId}:${viewerId}` : `view:${shortId}:${ip}`;
	if (viewedRecently.has(dedupKey)) {
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
