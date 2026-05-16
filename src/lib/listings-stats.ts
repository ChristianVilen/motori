import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { centsToEuros } from "~/lib/currency";

const getDb = async () => (await import("~/lib/db/index")).db;

const ADJACENT_REGIONS: Record<string, string[]> = {
	uusimaa: ["paijat-hame", "kanta-hame", "kymenlaakso"],
	pirkanmaa: ["kanta-hame", "satakunta", "keski-suomi"],
	"varsinais-suomi": ["satakunta", "kanta-hame", "uusimaa"],
	"pohjois-pohjanmaa": ["kainuu", "keski-pohjanmaa", "lappi"],
	"keski-suomi": ["pirkanmaa", "pohjois-savo", "etela-pohjanmaa"],
	"pohjois-savo": ["keski-suomi", "pohjois-karjala", "etela-savo"],
	"paijat-hame": ["uusimaa", "kanta-hame", "keski-suomi"],
	satakunta: ["pirkanmaa", "varsinais-suomi", "pohjanmaa"],
	pohjanmaa: ["etela-pohjanmaa", "keski-pohjanmaa", "satakunta"],
	lappi: ["pohjois-pohjanmaa", "kainuu"],
	"etela-karjala": ["kymenlaakso", "etela-savo", "paijat-hame"],
	"etela-savo": ["pohjois-savo", "etela-karjala", "paijat-hame"],
	kainuu: ["pohjois-pohjanmaa", "pohjois-karjala", "lappi"],
	"keski-pohjanmaa": ["pohjanmaa", "pohjois-pohjanmaa", "etela-pohjanmaa"],
	kymenlaakso: ["uusimaa", "etela-karjala", "paijat-hame"],
	"pohjois-karjala": ["pohjois-savo", "kainuu", "etela-savo"],
	"etela-pohjanmaa": ["pohjanmaa", "keski-suomi", "pirkanmaa"],
	"kanta-hame": ["uusimaa", "pirkanmaa", "paijat-hame"],
	ahvenanmaa: ["varsinais-suomi"],
};

export const getHomepageStats = createServerFn({ method: "GET" }).handler(async () => {
	const db = await getDb();
	const [countResult, priceResult] = await Promise.all([
		db
			.selectFrom("listing")
			.select([
				sql<number>`count(*)::int`.as("total"),
				sql<number>`count(distinct region)::int`.as("regions"),
			])
			.where("status", "=", "active")
			.executeTakeFirstOrThrow(),
		db
			.selectFrom("listing_rental")
			.innerJoin("listing", "listing.id", "listing_rental.listing_id")
			.select(sql<number>`coalesce(min(listing_rental.price_per_day), 0)::int`.as("min_price"))
			.where("listing.status", "=", "active")
			.executeTakeFirstOrThrow(),
	]);

	return {
		totalListings: countResult.total,
		regionCount: countResult.regions,
		minPricePerDay: Math.round(centsToEuros(priceResult.min_price)),
	};
});

export const getNeighborRegionCount = createServerFn({ method: "GET" })
	.inputValidator((region: string) => {
		if (!(region in ADJACENT_REGIONS)) {
			throw new Error("Unknown region");
		}
		return region;
	})
	.handler(async ({ data: region }) => {
		const neighbors = ADJACENT_REGIONS[region];
		if (!neighbors || neighbors.length === 0) {
			return 0;
		}
		const db = await getDb();
		const result = await db
			.selectFrom("listing")
			.select(sql<number>`count(*)::int`.as("count"))
			.where("status", "=", "active")
			.where("region", "in", neighbors)
			.executeTakeFirstOrThrow();

		return result.count;
	});
