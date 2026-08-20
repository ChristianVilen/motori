import { getRequest } from "@tanstack/react-start/server";
import { localeFromCookie } from "./detect-locale";
import { createI18nSync } from "./server";

/**
 * Locale-aware `t` for server-side schema validation. Resolves the request's
 * locale from the i18nextLng cookie, so createServerFn inputValidators return
 * messages in the caller's language.
 */
export function getValidationT(): (key: string) => string {
	const locale = localeFromCookie(getRequest().headers.get("cookie"));
	return createI18nSync(locale).getFixedT(locale, "common");
}
