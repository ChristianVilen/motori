const KEY = "motori:recentSearches";
const MAX = 5;

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecentSearches(): string[] {
	if (!isBrowser()) return [];
	const raw = window.localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
	} catch {
		return [];
	}
}

export function addRecentSearch(q: string): string[] {
	const trimmed = q.trim();
	if (!trimmed) return getRecentSearches();
	const current = getRecentSearches();
	const filtered = current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
	const next = [trimmed, ...filtered].slice(0, MAX);
	if (isBrowser()) {
		window.localStorage.setItem(KEY, JSON.stringify(next));
	}
	return next;
}

export function clearRecentSearches(): void {
	if (!isBrowser()) return;
	window.localStorage.removeItem(KEY);
}
