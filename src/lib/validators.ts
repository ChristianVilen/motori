// src/lib/validators.ts
import { z } from "zod";
import { CURRENT_YEAR } from "~/lib/constants";

export const listingFormSchema = z.object({
	title: z
		.string()
		.min(5, "Otsikko on liian lyhyt (min 5 merkkiä)")
		.max(100, "Otsikko on liian pitkä"),
	brand: z.string().min(1, "Valitse merkki"),
	model: z.string().min(1, "Malli on pakollinen").max(50),
	year: z
		.number()
		.int()
		.min(1970, "Vuosimalli liian vanha")
		.max(CURRENT_YEAR + 1, "Vuosimalli ei voi olla tulevaisuudessa"),
	engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
	motorcycle_type: z.string().min(1, "Valitse tyyppi"),
	required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
	price_per_day: z.number().min(1, "Päivähinta on pakollinen").max(10000),
	price_per_week: z.number().min(1).max(50000).nullable().optional(),
	deposit_amount: z.number().min(0).max(100000).nullable().optional(),
	price_description: z.string().max(200).nullable().optional(),
	city: z.string().min(1, "Kaupunki on pakollinen").max(100),
	region: z.string().min(1, "Valitse alue"),
	postal_code: z.string().max(10).nullable().optional(),
	available_from: z.string().nullable().optional(), // YYYY-MM-DD
	available_to: z.string().nullable().optional(), // YYYY-MM-DD
	season_only: z.boolean().default(false),
	description: z.string().min(20, "Kuvaus on liian lyhyt (min 20 merkkiä)").max(5000),
	mileage_limit: z.number().int().min(0).max(10000).nullable().optional(),
	image_urls: z.array(z.string()).max(8).default([]),
});

export type ListingFormData = z.infer<typeof listingFormSchema>;

export const browseSearchSchema = z.object({
	q: z.string().optional(),
	region: z.string().optional(),
	type: z.array(z.string()).optional(),
	license: z.array(z.string()).optional(),
	price_min: z.number().optional(),
	price_max: z.number().optional(),
	sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
	cursor: z.string().optional(),
});

export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;
