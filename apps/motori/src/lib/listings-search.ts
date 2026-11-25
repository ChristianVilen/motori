import { rateLimitMiddleware } from "@motori/server/rate-limit";
import { createServerFn } from "@tanstack/react-start";
import type { ListingCategory, ListingImage } from "~/lib/db/schema";
import type { ListingSummary } from "~/lib/listings-owner";
import { browseSearchSchema } from "~/lib/validators";
import { z } from "~/lib/zod";

const categorySchema = z.enum(["all", "sale", "rental", "gear", "part"]);
export type SearchCategory = ListingCategory | "all";
export type ListingWithImages = ListingSummary & { images: ListingImage[] };
export interface SearchResult {
	listings: ListingWithImages[];
	nextCursor: string | null;
	totalCount: number;
	mapCities?: { city: string; count: number }[];
}

export const searchListings = createServerFn({ method: "GET" })
	.middleware([rateLimitMiddleware(60, 60, "search")])
	.validator(browseSearchSchema.extend({ category: categorySchema }))
	.handler(async ({ data }): Promise<SearchResult> => {
		const { db } = await import("~/lib/db/index");
		const { searchListingPage } = await import("~/lib/listings-search.server");
		return searchListingPage(db, data);
	});
