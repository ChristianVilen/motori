export const SITE_URL = process.env.APP_ORIGIN ?? "http://localhost:3001";
export const MOTORI_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const SITE_NAME = "Talli";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export const DUE_SOON_KM = 500;
export const DUE_SOON_DAYS = 30;
export const MAX_PHOTOS_PER_RECORD = 8;

export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_SCAN_PAGES = 20;

export const DOC_TYPES = [
	{ key: "rekisteriote", label: "Rekisteriote" },
	{ key: "vakuutus", label: "Vakuutus" },
	{ key: "kuitti", label: "Kuitti" },
	{ key: "takuu", label: "Takuu" },
	{ key: "muu", label: "Muu" },
] as const;

export const REMINDER_PRESETS = [
	{
		key: "oljynvaihto",
		title: "Öljynvaihto",
		type: "interval",
		interval_km: 6000,
		interval_months: 12,
	},
	{
		key: "ketju",
		title: "Ketjun huolto",
		type: "interval",
		interval_km: 5000,
		interval_months: null,
	},
	{
		key: "jarruneste",
		title: "Jarrunesteen vaihto",
		type: "interval",
		interval_km: null,
		interval_months: 24,
	},
	{ key: "vakuutus", title: "Vakuutus", type: "date" },
	{ key: "ajoneuvovero", title: "Ajoneuvovero", type: "date" },
] as const;

export type PresetKey = (typeof REMINDER_PRESETS)[number]["key"];
