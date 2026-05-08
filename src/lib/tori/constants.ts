export const TORI_CATEGORIES = [
	{ value: "gear", labelKey: "tori.category.gear" },
	{ value: "parts", labelKey: "tori.category.parts" },
	{ value: "apparel", labelKey: "tori.category.apparel" },
	{ value: "tools", labelKey: "tori.category.tools" },
] as const;

export type ToriCategory = (typeof TORI_CATEGORIES)[number]["value"];

export const TORI_CONDITIONS = [
	{ value: "new", labelKey: "tori.condition.new" },
	{ value: "excellent", labelKey: "tori.condition.excellent" },
	{ value: "good", labelKey: "tori.condition.good" },
	{ value: "fair", labelKey: "tori.condition.fair" },
	{ value: "poor", labelKey: "tori.condition.poor" },
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
