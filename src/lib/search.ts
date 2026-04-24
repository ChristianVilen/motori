export function toTsQuery(query: string): string | null {
	const cleaned = query.replace(/[^\w\s\u00C0-\u024F]/g, "").trim();
	if (cleaned.length === 0) {
		return null;
	}
	return cleaned;
}
