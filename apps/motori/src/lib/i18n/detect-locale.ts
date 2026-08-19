import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type SupportedLocale, supportedLngs } from "./resources";

export function localeFromCookie(cookie: string | null): SupportedLocale {
	const match = cookie?.match(/(?:^|;\s*)i18nextLng=(\w+)/);
	if (match && (supportedLngs as readonly string[]).includes(match[1])) {
		return match[1] as SupportedLocale;
	}
	return "fi";
}

export const detectServerLocale = createServerFn().handler(
	async (): Promise<SupportedLocale> => localeFromCookie(getRequest().headers.get("cookie")),
);
