// Maps Zod issues from listingFormSchema onto listing-form field keys.
// Section-owned fields are prefixed in form state (price → sale_price),
// shared/motorcycle fields keep the schema name as-is.

export interface ListingIssue {
	path: PropertyKey[];
	message: string;
}

export function mapListingIssues(
	issues: readonly ListingIssue[],
	category: string,
	valueKeys: readonly string[],
): { fieldErrors: Record<string, string>; unmapped: string[] } {
	const keys = new Set(valueKeys);
	const fieldErrors: Record<string, string> = {};
	const unmapped: string[] = [];
	for (const issue of issues) {
		const name = issue.path[0];
		let target: string | undefined;
		if (typeof name === "string") {
			if (keys.has(name)) {
				target = name;
			} else if (keys.has(`${category}_${name}`)) {
				target = `${category}_${name}`;
			}
		}
		if (target === undefined) {
			unmapped.push(issue.message);
		} else if (!(target in fieldErrors)) {
			fieldErrors[target] = issue.message;
		}
	}
	return { fieldErrors, unmapped };
}
