export type ActiveTab = "browse" | "messages" | "account";

export function getActiveTab(pathname: string): ActiveTab | null {
	if (pathname === "/") {
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
