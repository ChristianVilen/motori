// Search helpers for PostgreSQL full-text search + trigram fallback.

/**
 * Sanitize input for websearch_to_tsquery (full-word FTS).
 * Returns null if input is empty.
 */
export function toTsQuery(query: string): string | null {
	const trimmed = query.trim();
	if (trimmed.length === 0) {
		return null;
	}
	return trimmed;
}

/**
 * Build a prefix-aware tsquery string for to_tsquery().
 * Splits input into words, stems all but the last via plainto_tsquery logic,
 * and appends :* to the last word for prefix matching.
 * Example: "shoei kypä" → "'shoei' & 'kypä':*"
 */
export function toPrefixTsQuery(query: string): string | null {
	const words = query.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		return null;
	}
	// Escape single quotes in each word
	const escaped = words.map((w) => w.replace(/'/g, "''"));
	if (escaped.length === 1) {
		return `'${escaped[0]}':*`;
	}
	const prefix = escaped.slice(0, -1).map((w) => `'${w}'`);
	const last = `'${escaped[escaped.length - 1]}':*`;
	return [...prefix, last].join(" & ");
}
