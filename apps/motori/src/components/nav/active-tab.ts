import { BROWSE_CATEGORIES, type BrowseCategory } from "~/lib/constants";

export type ActiveTab = "browse" | "messages" | "account";

export function getActiveTab(pathname: string): ActiveTab | null {
	if (
		pathname === "/" ||
		BROWSE_CATEGORIES.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))
	) {
		return "browse";
	}
	if (pathname === "/viestit" || pathname.startsWith("/viestit/")) {
		return "messages";
	}
	if (
		pathname === "/omat" ||
		pathname.startsWith("/omat/") ||
		pathname === "/profiili/asetukset" ||
		pathname.startsWith("/profiili/asetukset/")
	) {
		return "account";
	}
	return null;
}

export function getBrowseCategory(pathname: string): BrowseCategory {
	const match = BROWSE_CATEGORIES.find((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
	return match ?? BROWSE_CATEGORIES[0];
}
