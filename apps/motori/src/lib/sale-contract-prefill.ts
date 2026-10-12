import { createServerFn } from "@tanstack/react-start";
import { normalizeListingQuery, type SalePrefill } from "./sale-contract";

export const getContractPrefill = createServerFn({ method: "GET" })
	.inputValidator((value: unknown) => normalizeListingQuery(value))
	.handler(async ({ data }): Promise<SalePrefill | null> => {
		if (!data) {
			return null;
		}

		const { db } = await import("./db/index");
		const listing = await db
			.selectFrom("listing")
			.innerJoin("listing_sale", "listing_sale.listing_id", "listing.id")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.select([
				"motorcycle_make.name as make",
				"motorcycle_model.name as model",
				"listing.year",
				"listing_sale.km_driven",
				"listing_sale.color",
				"listing_sale.power_kw",
				"listing_sale.price",
			])
			.where("listing.short_id", "=", data)
			.where("listing.category", "=", "sale")
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		return listing ?? null;
	});
