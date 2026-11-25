import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ListingWithImages, SearchResult } from "~/lib/listings-search";

declare module "@tanstack/react-router" {
	interface HistoryState {
		listingFeed?: string;
	}
}

interface LoadedPage {
	nextCursor: string;
	listings: ListingWithImages[];
}

// Load more replaces the same history slot. Keep the earlier cards there while visiting a listing.
const feeds = new Map<number, { id: string; pages: LoadedPage[] }>();

export function useListingPages(data: SearchResult, cursor: string | undefined, browseTo: string) {
	const navigate = useNavigate();
	const history = useLocation({ select: (location) => location.state });
	const saved = feeds.get(history.__TSR_index);
	const pages = saved && saved.id === history.listingFeed ? saved.pages : undefined;
	const last = pages?.findIndex((page) => page.nextCursor === cursor) ?? -1;
	const allListings = useMemo(() => {
		if (!pages || last < 0) {
			return data.listings;
		}
		return [...pages.slice(0, last + 1).flatMap((page) => page.listings), ...data.listings];
	}, [data.listings, pages, last]);

	function loadMore() {
		const nextCursor = data.nextCursor;
		if (!nextCursor) {
			return;
		}
		const id = history.listingFeed ?? history.__TSR_key ?? crypto.randomUUID();
		feeds.set(history.__TSR_index, {
			id,
			pages: [...(pages?.slice(0, last + 1) ?? []), { nextCursor, listings: data.listings }],
		});
		void navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, cursor: nextCursor }),
			state: (prev) => ({ ...prev, listingFeed: id }),
			replace: true,
			resetScroll: false,
		});
	}

	return {
		allListings,
		loadMore,
		remaining: data.nextCursor ? data.totalCount - allListings.length : 0,
	};
}
