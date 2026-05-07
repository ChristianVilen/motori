import { z } from "zod";
import { MUNICIPALITY_NAME_SET } from "~/lib/municipalities";
import { TORI_CATEGORIES, TORI_CONDITIONS } from "~/lib/tori/constants";

const categoryValues = TORI_CATEGORIES.map((c) => c.value) as unknown as readonly [
	"gear",
	"parts",
	"apparel",
	"tools",
];
const conditionValues = TORI_CONDITIONS.map((c) => c.value) as unknown as readonly [
	"new",
	"excellent",
	"good",
	"fair",
	"poor",
];

export function toriImageSchema() {
	return z.object({
		url: z
			.string()
			.refine(
				(v) => v.startsWith("https://") || v.startsWith("/api/uploads/"),
				"Virheellinen kuva-URL",
			),
		thumbnail_url: z
			.string()
			.refine(
				(v) => v.startsWith("https://") || v.startsWith("/api/uploads/"),
				"Virheellinen kuva-URL",
			)
			.nullable()
			.optional(),
	});
}

export const toriItemFormSchema = z.object({
	title: z.string().trim().min(5, "Otsikko liian lyhyt").max(100, "Otsikko liian pitkä"),
	category: z.enum(categoryValues),
	condition: z.enum(conditionValues),
	price: z.number().min(1, "Hinta vaaditaan").max(100000),
	description: z.string().trim().min(20, "Kuvaus liian lyhyt").max(5000),
	city: z
		.string()
		.trim()
		.min(1, "Paikkakunta vaaditaan")
		.refine((v) => MUNICIPALITY_NAME_SET.has(v), "Virheellinen paikkakunta"),
	region: z.string().trim().min(1, "Maakunta vaaditaan"),
	postal_code: z.string().trim().max(10).nullable().optional(),
	images: z.array(toriImageSchema()).max(8).default([]),
});

export type ToriItemFormData = z.infer<typeof toriItemFormSchema>;

export const toriBrowseSearchSchema = z.object({
	q: z.string().trim().max(200).optional(),
	category: z.enum(categoryValues).optional(),
	condition: z.enum(conditionValues).optional(),
	region: z.string().trim().max(100).optional(),
	price_min: z.number().optional(),
	price_max: z.number().optional(),
	sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
	cursor: z.string().max(200).optional(),
});

export type ToriBrowseSearchParams = z.infer<typeof toriBrowseSearchSchema>;
