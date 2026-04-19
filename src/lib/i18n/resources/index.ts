import auth from "./fi/auth";
import common from "./fi/common";
import home from "./fi/home";
import listings from "./fi/listings";
import profile from "./fi/profile";

export const resources = {
	fi: { common, home, listings, auth, profile },
} as const;

export const defaultNS = "common" as const;
export const supportedLngs = ["fi"] as const;
export type SupportedLocale = (typeof supportedLngs)[number];
