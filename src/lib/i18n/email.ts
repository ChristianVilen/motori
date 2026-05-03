import { createI18nSync } from "~/lib/i18n/server";

export function getEmailT(lang: "fi" | "en") {
	return createI18nSync(lang).getFixedT(lang, "email");
}
