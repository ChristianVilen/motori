import { z } from "zod";
import { MAX_PHOTOS_PER_RECORD, REMINDER_PRESETS } from "~/lib/constants";

export function isValidImageUrl(url: string): boolean {
	return (
		url.startsWith("/api/uploads/") ||
		(!!process.env.STORAGE_PUBLIC_URL && url.startsWith(process.env.STORAGE_PUBLIC_URL))
	);
}

const imageUrl = z
	.string()
	.refine(
		(v) => v.startsWith("https://") || v.startsWith("/api/uploads/"),
		"Virheellinen kuva-URL",
	);

const isoDate = z.iso.date("Virheellinen päivämäärä");

const presetKeys = REMINDER_PRESETS.map((p) => p.key) as unknown as readonly [
	"oljynvaihto",
	"ketju",
	"jarruneste",
	"vakuutus",
	"ajoneuvovero",
];

const CURRENT_YEAR = new Date().getFullYear();

export const vehicleFormSchema = z.object({
	make: z.string().trim().min(1, "Merkki vaaditaan").max(50, "Merkki liian pitkä"),
	model: z.string().trim().min(1, "Malli vaaditaan").max(50, "Malli liian pitkä"),
	year: z
		.number()
		.int()
		.min(1900, "Virheellinen vuosi")
		.max(CURRENT_YEAR + 1, "Virheellinen vuosi")
		.nullable()
		.optional(),
	nickname: z.string().trim().max(50).nullable().optional(),
	plate: z.string().trim().max(20).nullable().optional(),
	vin: z.string().trim().max(30).nullable().optional(),
	odometer_km: z.number().int().min(0).max(2_000_000, "Virheellinen mittarilukema"),
	photo_url: imageUrl.nullable().optional(),
	thumbnail_url: imageUrl.nullable().optional(),
	presets: z.array(z.enum(presetKeys)).default([]),
});

export type VehicleFormData = z.infer<typeof vehicleFormSchema>;

export const reminderFormSchema = z
	.object({
		vehicle_id: z.string().uuid(),
		type: z.enum(["interval", "date"]),
		title: z.string().trim().min(1, "Otsikko vaaditaan").max(100, "Otsikko liian pitkä"),
		interval_km: z.number().int().min(1).max(200_000).nullable().optional(),
		interval_months: z.number().int().min(1).max(120).nullable().optional(),
		last_done_at: isoDate.nullable().optional(),
		last_done_km: z.number().int().min(0).max(2_000_000).nullable().optional(),
		due_date: isoDate.nullable().optional(),
	})
	.superRefine((r, ctx) => {
		if (r.type === "interval" && r.interval_km == null && r.interval_months == null) {
			ctx.addIssue({
				code: "custom",
				message: "Anna kilometri- tai kuukausiväli",
				path: ["interval_km"],
			});
		}
		if (r.type === "date" && r.due_date == null) {
			ctx.addIssue({ code: "custom", message: "Anna eräpäivä", path: ["due_date"] });
		}
	});

export type ReminderFormData = z.infer<typeof reminderFormSchema>;

const photoSchema = z.object({
	url: imageUrl,
	thumbnail_url: imageUrl,
});

export const serviceRecordFormSchema = z.object({
	vehicle_id: z.string().uuid(),
	reminder_id: z.string().uuid().nullable().optional(),
	performed_at: isoDate,
	odometer_km: z.number().int().min(0).max(2_000_000).nullable().optional(),
	title: z.string().trim().min(1, "Otsikko vaaditaan").max(100, "Otsikko liian pitkä"),
	notes: z.string().trim().max(5000, "Muistiinpanot liian pitkät").nullable().optional(),
	cost_eur: z.number().min(0).max(100_000).nullable().optional(),
	parts: z.string().trim().max(2000).nullable().optional(),
	photos: z.array(photoSchema).max(MAX_PHOTOS_PER_RECORD).default([]),
});

export type ServiceRecordFormData = z.infer<typeof serviceRecordFormSchema>;

export function eurosToCents(euros: number): number {
	return Math.round(euros * 100);
}
