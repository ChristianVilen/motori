import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources, type SupportedLocale, supportedLngs } from "./resources";

export async function createI18n(locale: SupportedLocale): Promise<i18n> {
	const instance = i18next.createInstance();
	await instance.use(initReactI18next).init({
		lng: locale,
		fallbackLng: "fi",
		supportedLngs: [...supportedLngs],
		defaultNS,
		ns: Object.keys(resources.fi),
		resources,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
	return instance;
}

// Synchronous variant — safe because all resources are bundled inline (no async fetch).
// The callback form of init() completes synchronously when resources are provided directly.
export function createI18nSync(locale: SupportedLocale): i18n {
	const instance = i18next.createInstance();
	instance.use(initReactI18next).init({
		lng: locale,
		fallbackLng: "fi",
		supportedLngs: [...supportedLngs],
		defaultNS,
		ns: Object.keys(resources.fi),
		resources,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
	return instance;
}
