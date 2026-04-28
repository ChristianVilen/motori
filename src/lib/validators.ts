// src/lib/validators.ts
import { z } from "zod";
import { CURRENT_YEAR } from "~/lib/constants";

const imageUrlSchema = z
	.string()
	.refine(
		(v) => v.startsWith("https://") || v.startsWith("/api/uploads/"),
		"Virheellinen kuva-URL",
	);

export const listingImageSchema = z.object({
	url: imageUrlSchema,
	thumbnail_url: imageUrlSchema.nullable().optional(),
});

export type ListingImageInput = z.infer<typeof listingImageSchema>;

export const listingFormSchema = z.object({
	title: z
		.string()
		.trim()
		.min(5, "Otsikko on liian lyhyt (min 5 merkkiä)")
		.max(100, "Otsikko on liian pitkä"),
	make_id: z.string().min(1, "Valitse merkki"),
	model_id: z.string().nullable().optional(),
	year: z
		.number()
		.int()
		.min(1970, "Vuosimalli liian vanha")
		.max(CURRENT_YEAR + 1, "Vuosimalli ei voi olla tulevaisuudessa"),
	engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
	motorcycle_type: z.string().trim().min(1, "Valitse tyyppi"),
	required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
	price_per_day: z.number().min(1, "Päivähinta on pakollinen").max(10000),
	price_per_week: z.number().min(1).max(50000).nullable().optional(),
	price_description: z.string().trim().max(200).nullable().optional(),
	city: z.string().trim().min(1, "Kaupunki on pakollinen").max(100),
	region: z.string().trim().min(1, "Valitse alue"),
	postal_code: z.string().trim().max(10).nullable().optional(),
	description: z.string().trim().min(20, "Kuvaus on liian lyhyt (min 20 merkkiä)").max(5000),
	mileage_limit: z.number().int().min(0).max(10000).nullable().optional(),
	images: z.array(listingImageSchema).max(8).default([]),
});

export type ListingFormData = z.infer<typeof listingFormSchema>;

export const browseSearchSchema = z.object({
	q: z.string().trim().max(200).optional(),
	region: z.string().trim().max(100).optional(),
	type: z.array(z.string().trim().max(50)).optional(),
	license: z.array(z.string().trim().max(10)).optional(),
	price_min: z.number().optional(),
	price_max: z.number().optional(),
	sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
	cursor: z.string().max(200).optional(),
});

export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;

const FINNISH_PHONE_RE = /^(\+358|0)\d{6,9}$/;

export function isValidImageUrl(url: string): boolean {
	return (
		url.startsWith("/api/uploads/") ||
		(!!process.env.STORAGE_PUBLIC_URL && url.startsWith(process.env.STORAGE_PUBLIC_URL)) ||
		url.startsWith("https://imagedelivery.net/")
	);
}

export function validateFinnishPhone(raw: string): string {
	const phone = raw.trim();
	if (phone && !FINNISH_PHONE_RE.test(phone.replace(/[\s-]/g, ""))) {
		throw new Error("Virheellinen puhelinnumero");
	}
	return phone;
}
