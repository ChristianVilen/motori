/**
 * Converts a user search query into a PostgreSQL tsquery string.
 *
 * - Strips non-alphanumeric characters (keeping Finnish chars äöåÄÖÅ)
 * - Splits on whitespace
 * - Appends :* to each term for prefix matching
 * - Joins with & (AND)
 *
 * Example: "honda hel" → "honda:* & hel:*"
 * Example: "" → null (no search)
 */
export function toTsQuery(query: string): string | null {
	const terms = query
		.replace(/[^\w\s\u00C0-\u024F]/g, "")
		.trim()
		.split(/\s+/)
		.filter((t) => t.length > 0);

	if (terms.length === 0) {
		return null;
	}

	return terms.map((t) => `${t}:*`).join(" & ");
}
