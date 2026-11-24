import { useState } from "react";
import type { SearchResult } from "~/lib/listings-search";
import type { BrowseSearchParams } from "~/lib/validators";

export function useListingPages(data: SearchResult, search: BrowseSearchParams) {
	const { cursor, view, ...filters } = search;
	const key = JSON.stringify(filters);
	const [state, setState] = useState(() => ({ key, pages: [{ cursor, data }] }));
	let pages = state.pages;
	const last = pages[pages.length - 1];
	if (state.key !== key || last.cursor !== cursor || last.data !== data) {
		const previous =
			state.key === key && cursor ? pages.findIndex((p) => p.data.nextCursor === cursor) : -1;
		pages = [...pages.slice(0, previous + 1), { cursor, data }];
		setState({ key, pages });
	}
	const allListings = pages.flatMap((p) => p.data.listings);
	return {
		allListings,
		totalCount: data.totalCount,
		nextCursor: data.nextCursor,
		remaining: data.totalCount - allListings.length,
	};
}
