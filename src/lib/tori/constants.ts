export const TORI_CATEGORIES = [
	{ value: "gear", label: "Ajovarusteet" },
	{ value: "parts", label: "Osat & tarvikkeet" },
	{ value: "apparel", label: "Vaatteet & merch" },
	{ value: "tools", label: "Työkalut" },
] as const;

export type ToriCategory = (typeof TORI_CATEGORIES)[number]["value"];

export const TORI_CONDITIONS = [
	{ value: "new", label: "Uusi" },
	{ value: "excellent", label: "Erinomainen" },
	{ value: "good", label: "Hyvä" },
	{ value: "fair", label: "Tyydyttävä" },
	{ value: "poor", label: "Huono" },
] as const;

export type ToriCondition = (typeof TORI_CONDITIONS)[number]["value"];

export const TORI_STATUSES = {
	active: "Aktiivinen",
	paused: "Tauolla",
	sold: "Myyty",
	expired: "Vanhentunut",
} as const;

export type ToriStatus = keyof typeof TORI_STATUSES;

export const TORI_EXPIRY_DAYS = 90;
