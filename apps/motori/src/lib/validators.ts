// src/lib/validators.ts
import { z } from "zod";
import {
	CONDITIONS,
	CURRENT_YEAR,
	GEAR_SIZES,
	GEAR_TYPES,
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
	PART_CATEGORIES,
} from "~/lib/constants";
import fiCommon from "~/lib/i18n/resources/fi/common";
import { MUNICIPALITY_NAME_SET } from "~/lib/municipalities";

export type { Condition, GearTypeValue } from "~/lib/constants";
export { CONDITIONS, GEAR_TYPES };

type T = (key: string) => string;

const defaultT: T = (key) => {
	const k = key.replace("validation.", "") as keyof typeof fiCommon.validation;
	return fiCommon.validation[k] ?? key;
};

function imageUrlSchema(t: T) {
	return z
		.string()
		.refine(
			(v) => v.startsWith("https://") || v.startsWith("/api/uploads/"),
			t("validation.invalidImageUrl"),
		);
}

export function listingImageSchema(t: T = defaultT) {
	return z.object({
		url: imageUrlSchema(t),
		thumbnail_url: imageUrlSchema(t).nullable().optional(),
	});
}

export type ListingImageInput = z.infer<ReturnType<typeof listingImageSchema>>;

function sharedFields(t: T) {
	return {
		title: z
			.string()
			.trim()
			.min(5, t("validation.titleTooShort"))
			.max(100, t("validation.titleTooLong")),
		city: z
			.string()
			.trim()
			.min(1, t("validation.cityRequired"))
			.refine((v) => MUNICIPALITY_NAME_SET.has(v), t("validation.cityInvalid")),
		region: z.string().trim().min(1, t("validation.regionRequired")),
		postal_code: z.string().trim().max(10).nullable().optional(),
		description: z
			.string()
			.trim()
			.min(20, t("validation.descriptionTooShort"))
			.max(5000, t("validation.valueInvalid")),
		// No .default([]) — it would short-circuit .min(1) for requests that omit
		// the field entirely, letting a crafted POST create a zero-image listing.
		images: z.array(listingImageSchema(t)).min(1, t("validation.imagesRequired")).max(8),
	};
}

function priceSchema(t: T, max: number) {
	return z
		.number({ error: t("validation.priceRequired") })
		.int(t("validation.priceInvalid"))
		.min(1, t("validation.priceRequired"))
		.max(max, t("validation.priceInvalid"));
}

export function listingFormSchema(t: T = defaultT) {
	const shared = sharedFields(t);
	return z.discriminatedUnion("category", [
		z.object({
			...shared,
			category: z.literal("rental"),
			make_id: z.string().min(1, t("validation.brandRequired")),
			model_id: z.string().nullable().optional(),
			year: z
				.number({ error: t("validation.yearRequired") })
				.int(t("validation.valueInvalid"))
				.min(1970, t("validation.yearTooOld"))
				.max(CURRENT_YEAR + 1, t("validation.yearInFuture")),
			engine_cc: z
				.number()
				.int(t("validation.valueInvalid"))
				.min(50, t("validation.valueInvalid"))
				.max(3000, t("validation.valueInvalid"))
				.nullable()
				.optional(),
			motorcycle_type: z.string().trim().min(1, t("validation.typeRequired")),
			required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
			price_per_day: z
				.number({ error: t("validation.pricePerDayRequired") })
				.min(1, t("validation.pricePerDayRequired"))
				.max(10000, t("validation.valueInvalid")),
			price_per_week: z
				.number()
				.min(1, t("validation.priceInvalid"))
				.max(50000, t("validation.priceInvalid"))
				.nullable()
				.optional(),
			price_per_weekend: z
				.number()
				.min(1, t("validation.priceInvalid"))
				.max(50000, t("validation.priceInvalid"))
				.nullable()
				.optional(),
			price_description: z
				.string()
				.trim()
				.max(200, t("validation.valueInvalid"))
				.nullable()
				.optional(),
			mileage_limit: z
				.number()
				.int(t("validation.valueInvalid"))
				.min(0, t("validation.valueInvalid"))
				.max(10000, t("validation.valueInvalid"))
				.nullable()
				.optional(),
		}),
		z.object({
			...shared,
			category: z.literal("sale"),
			make_id: z.string().min(1, t("validation.brandRequired")),
			model_id: z
				.string({ error: t("validation.modelRequired") })
				.min(1, t("validation.modelRequired")),
			year: z
				.number({ error: t("validation.yearRequired") })
				.int(t("validation.valueInvalid"))
				.min(1970, t("validation.yearTooOld"))
				.max(CURRENT_YEAR + 1, t("validation.yearInFuture")),
			engine_cc: z
				.number()
				.int(t("validation.valueInvalid"))
				.min(50, t("validation.valueInvalid"))
				.max(3000, t("validation.valueInvalid"))
				.nullable()
				.optional(),
			motorcycle_type: z.string().trim().min(1, t("validation.typeRequired")),
			required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
			condition: z.enum(CONDITIONS, { error: t("validation.conditionRequired") }),
			km_driven: z
				.number({ error: t("validation.kmRequired") })
				.int(t("validation.valueInvalid"))
				.min(0, t("validation.kmRequired"))
				.max(999999, t("validation.valueInvalid")),
			color: z.string().trim().max(30).nullable().optional(),
			owner_count: z
				.number()
				.int(t("validation.valueInvalid"))
				.min(1, t("validation.valueInvalid"))
				.max(99, t("validation.valueInvalid"))
				.nullable()
				.optional(),
			power_kw: z
				.number()
				.int(t("validation.valueInvalid"))
				.min(1, t("validation.valueInvalid"))
				.max(500, t("validation.valueInvalid"))
				.nullable()
				.optional(),
			trade_possible: z.boolean().default(false),
			price: priceSchema(t, 1_000_000),
			negotiable: z.boolean().default(false),
		}),
		z.object({
			...shared,
			category: z.literal("gear"),
			gear_type: z.enum(GEAR_TYPES, { error: t("validation.typeRequired") }),
			size: z.enum(GEAR_SIZES).nullable().optional(),
			brand: z.string().trim().max(50).nullable().optional(),
			condition: z.enum(CONDITIONS, { error: t("validation.conditionRequired") }),
			price: priceSchema(t, 100_000),
		}),
		z.object({
			...shared,
			category: z.literal("part"),
			part_category: z.string().trim().min(1, t("validation.partCategoryRequired")).max(100),
			compatible_make_id: z.string().nullable().optional(),
			compatible_model_id: z.string().nullable().optional(),
			oem_number: z.string().trim().max(50).nullable().optional(),
			condition: z.enum(CONDITIONS, { error: t("validation.conditionRequired") }),
			price: priceSchema(t, 100_000),
		}),
	]);
}

export type ListingFormData = z.infer<ReturnType<typeof listingFormSchema>>;
export type RentalFormData = Extract<ListingFormData, { category: "rental" }>;
export type SaleFormData = Extract<ListingFormData, { category: "sale" }>;
export type GearFormData = Extract<ListingFormData, { category: "gear" }>;
export type PartFormData = Extract<ListingFormData, { category: "part" }>;

export const browseSearchSchema = z.object({
	q: z.string().trim().max(200).optional(),
	region: z.string().trim().max(100).optional(),
	type: z.array(z.enum(MOTORCYCLE_TYPES.map((t) => t.value) as [string, ...string[]])).optional(),
	license: z.array(z.enum(LICENSE_CLASSES.map((l) => l.value) as [string, ...string[]])).optional(),
	price_min: z.number().optional(),
	price_max: z.number().optional(),
	cc_min: z.number().int().min(1).optional(),
	cc_max: z.number().int().min(1).optional(),
	year_min: z.number().int().min(1970).optional(),
	year_max: z
		.number()
		.int()
		.min(1970)
		.max(CURRENT_YEAR + 1)
		.optional(),
	make: z.string().trim().max(100).optional(),
	gear_type: z.enum(GEAR_TYPES).optional(),
	condition: z.enum(CONDITIONS).optional(),
	part_category: z.enum(PART_CATEGORIES.map((c) => c.value) as [string, ...string[]]).optional(),
	size: z.enum(GEAR_SIZES).optional(),
	km_max: z.number().int().min(0).optional(),
	sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
	cursor: z.string().max(200).optional(),
	view: z.enum(["list", "map"]).optional(),
	city: z.string().trim().max(100).optional(),
});

export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;

// Persisted shape for saved searches: cursor is pagination state, view/city are
// client-only map UI state — none of these should survive a save.
export const savedSearchParamsSchema = browseSearchSchema.omit({
	cursor: true,
	view: true,
	city: true,
});

export type SavedSearchParams = z.infer<typeof savedSearchParamsSchema>;

export function countActiveFilters(search: BrowseSearchParams): number {
	return (
		(search.region ? 1 : 0) +
		(search.type?.length ?? 0) +
		(search.license?.length ?? 0) +
		(search.price_min != null ? 1 : 0) +
		(search.price_max != null ? 1 : 0) +
		(search.cc_min != null ? 1 : 0) +
		(search.cc_max != null ? 1 : 0) +
		(search.year_min != null ? 1 : 0) +
		(search.year_max != null ? 1 : 0) +
		(search.make ? 1 : 0) +
		(search.gear_type ? 1 : 0) +
		(search.condition ? 1 : 0) +
		(search.part_category ? 1 : 0) +
		(search.size ? 1 : 0) +
		(search.km_max != null ? 1 : 0)
	);
}

const FINNISH_PHONE_RE = /^(\+358|0)\d{6,9}$/;

export function isValidImageUrl(url: string): boolean {
	return (
		url.startsWith("/api/uploads/") ||
		(!!process.env.STORAGE_PUBLIC_URL && url.startsWith(process.env.STORAGE_PUBLIC_URL))
	);
}

export function validateFinnishPhone(raw: string, errorMsg?: string): string {
	const phone = raw.trim();
	if (phone && !FINNISH_PHONE_RE.test(phone.replace(/[\s-]/g, ""))) {
		throw new Error(errorMsg ?? "Virheellinen puhelinnumero");
	}
	return phone;
}

const isoDate = z.iso.date("Virheellinen päivämäärä");

function todayIsoDate(): string {
	return new Date().toISOString().slice(0, 10);
}

export const bookingRequestSchema = z
	.object({
		listing_id: z.string().uuid(),
		start_date: isoDate,
		end_date: isoDate,
		message: z.string().trim().min(1, "Viesti on pakollinen").max(500, "Viesti on liian pitkä"),
	})
	.refine((d) => d.end_date >= d.start_date, {
		message: "Loppupäivä ennen aloituspäivää",
		path: ["end_date"],
	})
	.refine((d) => d.start_date >= todayIsoDate(), {
		message: "Aloituspäivä menneisyydessä",
		path: ["start_date"],
	});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const bookingIdSchema = z.object({ id: z.string().uuid() });

export const bookingRejectSchema = z.object({
	id: z.string().uuid(),
	reason: z.string().trim().max(500).optional(),
});

export const availabilityUpdateSchema = z.object({
	listing_id: z.string().uuid(),
	availability_default: z.enum(["open", "closed"]),
	exception_dates: z.array(isoDate).max(366),
});

export type AvailabilityUpdateInput = z.infer<typeof availabilityUpdateSchema>;

export const submitReviewSchema = z.object({
	booking_id: z.string().uuid(),
	rating: z.number().int().min(1).max(5),
	comment: z.string().trim().max(1000).optional(),
});
