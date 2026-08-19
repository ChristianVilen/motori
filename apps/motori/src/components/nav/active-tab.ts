export type ActiveTab = "browse" | "messages" | "account";

export function getActiveTab(pathname: string): ActiveTab | null {
	if (
		pathname === "/" ||
		pathname === "/pyorat/myynti" ||
		pathname.startsWith("/pyorat/myynti/") ||
		pathname === "/pyorat/vuokraus" ||
		pathname.startsWith("/pyorat/vuokraus/") ||
		pathname === "/varusteet" ||
		pathname.startsWith("/varusteet/") ||
		pathname === "/varaosat" ||
		pathname.startsWith("/varaosat/")
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
