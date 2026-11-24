import { useTranslation } from "react-i18next";
import { supportedLngs } from "~/lib/i18n/resources";

export function LanguageSelector() {
	const { i18n, t } = useTranslation("common");
	return (
		<div className="flex items-center text-sm text-muted">
			{supportedLngs.map((lng, i) => (
				<span key={lng} className="flex items-center">
					{i > 0 && <span aria-hidden="true">|</span>}
					<button
						type="button"
						lang={lng}
						aria-pressed={i18n.language === lng}
						aria-label={t("nav.switchLanguage", { lang: lng.toUpperCase() })}
						onClick={() => i18n.changeLanguage(lng)}
						className="min-h-11 min-w-10 rounded-lg px-1.5 font-medium tracking-wide aria-pressed:font-bold aria-pressed:text-foreground"
					>
						{lng.toUpperCase()}
					</button>
				</span>
			))}
		</div>
	);
}
