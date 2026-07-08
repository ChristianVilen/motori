export const SITE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const SITE_NAME = "Motori";

// Single source of truth for the image upload size cap. Enforced client-side
// (use-image-upload, tori-item-form) and server-side (api/images/upload) — these
// must not diverge, or uploads pass client validation then fail at the server.
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_MB = MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024);

export const REGIONS = [
	{ value: "uusimaa", label: "Uusimaa" },
	{ value: "pirkanmaa", label: "Pirkanmaa" },
	{ value: "varsinais-suomi", label: "Varsinais-Suomi" },
	{ value: "pohjois-pohjanmaa", label: "Pohjois-Pohjanmaa" },
	{ value: "keski-suomi", label: "Keski-Suomi" },
	{ value: "pohjois-savo", label: "Pohjois-Savo" },
	{ value: "paijat-hame", label: "Päijät-Häme" },
	{ value: "satakunta", label: "Satakunta" },
	{ value: "pohjanmaa", label: "Pohjanmaa" },
	{ value: "lappi", label: "Lappi" },
	{ value: "etela-karjala", label: "Etelä-Karjala" },
	{ value: "etela-savo", label: "Etelä-Savo" },
	{ value: "kainuu", label: "Kainuu" },
	{ value: "keski-pohjanmaa", label: "Keski-Pohjanmaa" },
	{ value: "kymenlaakso", label: "Kymenlaakso" },
	{ value: "pohjois-karjala", label: "Pohjois-Karjala" },
	{ value: "etela-pohjanmaa", label: "Etelä-Pohjanmaa" },
	{ value: "kanta-hame", label: "Kanta-Häme" },
	{ value: "ahvenanmaa", label: "Ahvenanmaa" },
] as const;

export type Region = (typeof REGIONS)[number]["value"];

export const MOTORCYCLE_TYPES = [
	{ value: "naked", label: "Naked" },
	{ value: "sport", label: "Sport" },
	{ value: "touring", label: "Touring" },
	{ value: "adventure", label: "Adventure" },
	{ value: "cruiser", label: "Cruiser" },
	{ value: "enduro", label: "Enduro" },
	{ value: "motocross", label: "Motocross" },
	{ value: "scooter", label: "Skootteri" },
	{ value: "custom", label: "Custom" },
] as const;

export type MotorcycleType = (typeof MOTORCYCLE_TYPES)[number]["value"];

export const LICENSE_CLASSES = [
	{ value: "A1", label: "A1", description: "≤125cc, ≤11kW, 16v+" },
	{ value: "A2", label: "A2", description: "≤35kW, 18v+" },
	{ value: "A", label: "A", description: "Rajoittamaton, 24v+" },
] as const;

export type LicenseClass = (typeof LICENSE_CLASSES)[number]["value"];

export const LISTING_STATUSES = {
	active: "Aktiivinen",
	paused: "Tauolla",
	sold: "Myyty",
	rented: "Vuokrattu",
	removed: "Poistettu",
	expired: "Vanhentunut",
} as const;

export type ListingStatus = keyof typeof LISTING_STATUSES;

export const CURRENT_YEAR = new Date().getFullYear();

export const SORT_OPTIONS = [
	{ value: "newest", label: "Uusimmat ensin" },
	{ value: "price_asc", label: "Hinta: halvin" },
	{ value: "price_desc", label: "Hinta: kallein" },
	{ value: "relevance", label: "Osuvimmat" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const TYPE_EMOJI: Record<string, string> = {
	naked: "\u26A1",
	sport: "\uD83C\uDFCE",
	touring: "\uD83E\uDDED",
	adventure: "\uD83C\uDFD4",
	cruiser: "\uD83D\uDEE3",
	enduro: "\uD83C\uDF32",
	motocross: "\uD83C\uDFC1",
	scooter: "\uD83D\uDEF5",
	custom: "\uD83D\uDD27",
};

export const PART_CATEGORIES = [
	{ value: "brakes", label: "Jarrut" },
	{ value: "tires", label: "Renkaat" },
	{ value: "exhaust", label: "Pakosarja" },
	{ value: "bodywork", label: "Korit" },
	{ value: "electrical", label: "Sähkö" },
	{ value: "engine", label: "Moottori" },
	{ value: "suspension", label: "Jousitus" },
	{ value: "transmission", label: "Voimansiirto" },
	{ value: "lights", label: "Valot" },
	{ value: "other", label: "Muu" },
] as const;

export type PartCategory = (typeof PART_CATEGORIES)[number]["value"];

export const GEAR_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "muu"] as const;
export type GearSize = (typeof GEAR_SIZES)[number];

export const CONDITIONS = ["new", "excellent", "good", "fair", "poor"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const GEAR_TYPES = ["helmet", "jacket", "pants", "boots", "gloves", "other"] as const;
export type GearTypeValue = (typeof GEAR_TYPES)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
	new: "Uusi",
	excellent: "Erinomainen",
	good: "Hyvä",
	fair: "Tyydyttävä",
	poor: "Huono",
};

export const GEAR_TYPE_LABELS: Record<GearTypeValue, string> = {
	helmet: "Kypärä",
	jacket: "Takki",
	pants: "Housut",
	boots: "Saappaat",
	gloves: "Käsineet",
	other: "Muu",
};
