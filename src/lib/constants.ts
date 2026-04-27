export const SITE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
export const SITE_NAME = "Motori";

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

export const MOTORCYCLE_BRANDS = [
	"Aprilia",
	"Beta",
	"BMW",
	"Can-Am",
	"Ducati",
	"Energica",
	"GasGas",
	"Harley-Davidson",
	"Honda",
	"Husaberg",
	"Husqvarna",
	"Indian",
	"Kawasaki",
	"KTM",
	"Moto Guzzi",
	"Royal Enfield",
	"Sherco",
	"Suzuki",
	"Triumph",
	"Yamaha",
	"Zero",
	"Muu",
];

export const LISTING_STATUSES = {
	active: "Aktiivinen",
	paused: "Tauolla",
	rented: "Vuokrattu",
	removed: "Poistettu",
} as const;

export type ListingStatus = keyof typeof LISTING_STATUSES;

export const CURRENT_YEAR = new Date().getFullYear();

export const ADJACENT_REGIONS: Record<string, string[]> = {
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
