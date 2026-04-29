import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateShortId(): string {
	const bytes = randomBytes(8);
	let result = "";
	for (const byte of bytes) {
		result += BASE62[byte % 62];
	}
	return result;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[äå]/g, "a")
		.replace(/ö/g, "o")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function computeListingSlug(
	makeSlug: string | null,
	modelName: string | null,
	city: string,
): string {
	const parts = [makeSlug, modelName ? slugify(modelName) : null, slugify(city)].filter(
		(p): p is string => !!p,
	);
	return parts.join("-");
}
