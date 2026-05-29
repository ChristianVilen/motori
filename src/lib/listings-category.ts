import type { Database, ListingCategory } from "~/lib/db/schema";

// Single source of truth mapping a listing category to its child table.
// Consumed by listings-search (query building), listings-detail (child fetch),
// and listings-commands (insert/update) so the category→table dispatch lives
// in one place instead of being re-spelled in each module.
export const CATEGORY_CHILD_TABLE = {
	rental: "listing_rental",
	sale: "listing_sale",
	gear: "listing_gear",
	part: "listing_part",
} as const satisfies Record<ListingCategory, keyof Database>;

export type ChildTable = (typeof CATEGORY_CHILD_TABLE)[ListingCategory];
