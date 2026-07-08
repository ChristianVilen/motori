import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { type SupportedLocale, supportedLngs } from "./resources";

export const detectServerLocale = createServerFn().handler(async (): Promise<SupportedLocale> => {
	const req = getRequest();
	const cookie = req.headers.get("cookie") ?? "";
	const match = cookie.match(/(?:^|;\s*)i18nextLng=(\w+)/);
	if (match && (supportedLngs as readonly string[]).includes(match[1])) {
		return match[1] as SupportedLocale;
	}
	return "fi";
});
