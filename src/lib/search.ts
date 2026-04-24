// Sanitize user search input for use with websearch_to_tsquery.
// websearch_to_tsquery handles operator escaping internally (no injection risk),
// but does not support prefix matching — "hon" won't match "honda".
// Tradeoff: safety over partial-word matching. For prefix search, consider
// adding a separate pg_trgm index or client-side autocomplete.
export function toTsQuery(query: string): string | null {
	const cleaned = query.replace(/[^\w\s\u00C0-\u024F]/g, "").trim();
	if (cleaned.length === 0) {
		return null;
	}
	return cleaned;
}
