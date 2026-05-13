export type ActiveTab = "browse" | "bookings" | "account";

export function getActiveTab(pathname: string): ActiveTab | null {
	if (pathname === "/") return "browse";
	if (pathname === "/omat" || pathname.startsWith("/omat/")) return "bookings";
	if (pathname === "/asetukset" || pathname.startsWith("/asetukset/")) return "account";
	return null;
}
