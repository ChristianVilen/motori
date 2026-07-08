import { useTranslation } from "react-i18next";
import type { SupportedLocale } from "~/lib/i18n/resources";

const labels: Record<SupportedLocale, string> = { fi: "FI", en: "EN" };

export function LanguageSelector() {
	const { i18n, t } = useTranslation("common");
	const current = i18n.language as SupportedLocale;
	const next: SupportedLocale = current === "fi" ? "en" : "fi";

	return (
		<button
			type="button"
			onClick={() => i18n.changeLanguage(next)}
			className="text-sm font-medium text-white/70 hover:text-white"
			aria-label={t("nav.switchLanguage", { lang: labels[next] })}
		>
			{labels[next]}
		</button>
	);
}
