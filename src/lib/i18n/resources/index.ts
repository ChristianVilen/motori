import enAuth from "./en/auth";
import enCommon from "./en/common";
import enEmail from "./en/email";
import enErrors from "./en/errors";
import enHome from "./en/home";
import enListings from "./en/listings";
import enProfile from "./en/profile";
import fiAuth from "./fi/auth";
import fiCommon from "./fi/common";
import fiEmail from "./fi/email";
import fiErrors from "./fi/errors";
import fiHome from "./fi/home";
import fiListings from "./fi/listings";
import fiProfile from "./fi/profile";

export const resources = {
	fi: {
		common: fiCommon,
		home: fiHome,
		listings: fiListings,
		auth: fiAuth,
		profile: fiProfile,
		email: fiEmail,
		errors: fiErrors,
	},
	en: {
		common: enCommon,
		home: enHome,
		listings: enListings,
		auth: enAuth,
		profile: enProfile,
		email: enEmail,
		errors: enErrors,
	},
} as const;

export const defaultNS = "common" as const;
export const supportedLngs = ["fi", "en"] as const;
export type SupportedLocale = (typeof supportedLngs)[number];
