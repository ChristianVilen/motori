import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources, supportedLngs } from "./resources";

let bootstrapped = false;

export function ensureClientI18n(lng?: string): void {
	if (bootstrapped) {
		return;
	}
	bootstrapped = true;
	i18next
		.use(LanguageDetector)
		.use(initReactI18next)
		.init({
			lng,
			fallbackLng: "fi",
			supportedLngs: [...supportedLngs],
			defaultNS,
			ns: Object.keys(resources.fi),
			resources,
			interpolation: { escapeValue: false },
			react: { useSuspense: false },
			detection: {
				order: ["cookie", "localStorage", "navigator"],
				lookupCookie: "i18nextLng",
				lookupLocalStorage: "i18nextLng",
				caches: ["cookie", "localStorage"],
				cookieOptions: { path: "/", sameSite: "lax" },
			},
			showSupportNotice: false,
		});
}

export { default as i18n } from "i18next";
