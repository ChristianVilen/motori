import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources, type SupportedLocale, supportedLngs } from "./resources";

declare global {
	interface Window {
		__I18N__?: { locale: SupportedLocale };
	}
}

let bootstrapped = false;

export function ensureClientI18n(): void {
	if (bootstrapped) {
		return;
	}
	bootstrapped = true;
	const locale: SupportedLocale = window.__I18N__?.locale ?? "fi";
	i18next.use(initReactI18next).init({
		lng: locale,
		fallbackLng: "fi",
		supportedLngs: [...supportedLngs],
		defaultNS,
		ns: Object.keys(resources.fi),
		resources,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
}

export async function changeClientLocale(locale: SupportedLocale): Promise<void> {
	if (i18next.language !== locale) {
		await i18next.changeLanguage(locale);
	}
}

export { default as i18n } from "i18next";
