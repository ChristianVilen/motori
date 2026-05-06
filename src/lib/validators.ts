// src/lib/validators.ts
import { z } from "zod";
import { CURRENT_YEAR, LICENSE_CLASSES, MOTORCYCLE_TYPES } from "~/lib/constants";
import fiCommon from "~/lib/i18n/resources/fi/common";
import { MUNICIPALITY_NAME_SET } from "~/lib/municipalities";

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

export function listingFormSchema(t: T = defaultT) {
	return z.object({
		title: z
			.string()
			.trim()
			.min(5, t("validation.titleTooShort"))
			.max(100, t("validation.titleTooLong")),
		make_id: z.string().min(1, t("validation.brandRequired")),
		model_id: z.string().nullable().optional(),
		year: z
			.number()
			.int()
			.min(1970, t("validation.yearTooOld"))
			.max(CURRENT_YEAR + 1, t("validation.yearInFuture")),
		engine_cc: z.number().int().min(50).max(3000).nullable().optional(),
		motorcycle_type: z.string().trim().min(1, t("validation.typeRequired")),
		required_license: z.enum(["A1", "A2", "A"]).nullable().optional(),
		price_per_day: z.number().min(1, t("validation.pricePerDayRequired")).max(10000),
		price_per_week: z.number().min(1).max(50000).nullable().optional(),
		price_per_weekend: z.number().min(1).max(50000).nullable().optional(),
		price_description: z.string().trim().max(200).nullable().optional(),
		city: z
			.string()
			.trim()
			.min(1, t("validation.cityRequired"))
			.refine((v) => MUNICIPALITY_NAME_SET.has(v), t("validation.cityInvalid")),
		region: z.string().trim().min(1, t("validation.regionRequired")),
		postal_code: z.string().trim().max(10).nullable().optional(),
		description: z.string().trim().min(20, t("validation.descriptionTooShort")).max(5000),
		mileage_limit: z.number().int().min(0).max(10000).nullable().optional(),
		images: z.array(listingImageSchema(t)).max(8).default([]),
	});
}

export type ListingFormData = z.infer<ReturnType<typeof listingFormSchema>>;

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
	sort: z.enum(["newest", "price_asc", "price_desc", "relevance"]).optional(),
	cursor: z.string().max(200).optional(),
	view: z.enum(["list", "map"]).optional(),
	city: z.string().trim().max(100).optional(),
});

export type BrowseSearchParams = z.infer<typeof browseSearchSchema>;

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
		(search.make ? 1 : 0)
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
