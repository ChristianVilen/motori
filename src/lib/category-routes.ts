// Category → URL path mapping.
// Single source of truth for browse and detail paths across all categories.
import type { ListingCategory } from "~/lib/db/schema";

export const CATEGORY_BROWSE_PATH: Record<ListingCategory, string> = {
	sale: "/pyorat/myynti",
	rental: "/pyorat/vuokraus",
	gear: "/varusteet",
	part: "/varaosat",
};

export function categoryBrowsePath(category: ListingCategory): string {
	return CATEGORY_BROWSE_PATH[category];
}

export function categoryDetailPath(
	category: ListingCategory,
	shortId: string,
	slug: string,
): string {
	return `${CATEGORY_BROWSE_PATH[category]}/${shortId}/${slug}`;
}
