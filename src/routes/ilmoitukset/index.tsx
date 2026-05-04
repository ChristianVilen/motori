import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { EmptyState, LowResultNudge } from "~/components/listings/empty-state";
import { FilterDrawer } from "~/components/listings/filter-drawer";
import { FilterSidebar } from "~/components/listings/filter-sidebar";
import { ListingCard } from "~/components/listings/listing-card";
import { ListingCardSkeleton } from "~/components/listings/listing-card-skeleton";
import { REGIONS, SITE_NAME, SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { type SearchResult, searchListings } from "~/lib/listings";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { type BrowseSearchParams, browseSearchSchema, countActiveFilters } from "~/lib/validators";

const ListingsMap = lazy(() =>
	import("~/components/listings/listings-map").then((m) => ({ default: m.ListingsMap })),
);

export const Route = createFileRoute("/ilmoitukset/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const [result, session, makes] = await Promise.all([
			searchListings({ data: deps }),
			getSession(),
			getMakes(),
		]);
		return { ...result, currentUserId: session?.user.id ?? null, makes };
	},
	head: () => ({
		meta: [
			{ title: `Selaa ilmoituksia — ${SITE_NAME}` },
			{
				name: "description",
				content:
					"Selaa moottoripyörien vuokrausilmoituksia. Suodata alueen, tyypin ja hinnan mukaan.",
			},
			{ property: "og:url", content: `${SITE_URL}/ilmoitukset` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/ilmoitukset` }],
	}),
	component: BrowsePage,
});

function useAccumulatedPages(initialData: SearchResult, search: BrowseSearchParams) {
	const [pages, setPages] = useState<SearchResult[]>([initialData]);
	const prevSearchKey = useRef(searchKeyWithoutCursor(search));

	const currentKey = searchKeyWithoutCursor(search);
	if (currentKey !== prevSearchKey.current) {
		prevSearchKey.current = currentKey;
		setPages([initialData]);
	} else if (
		pages.length > 0 &&
		pages[pages.length - 1].nextCursor !== initialData.nextCursor &&
		search.cursor
	) {
		if (!pages.some((p) => p.nextCursor === initialData.nextCursor)) {
			setPages((prev) => [...prev, initialData]);
		}
	}

	const allListings = pages.flatMap((p) => p.listings);
	const totalCount = pages[0].totalCount;
	const nextCursor = pages[pages.length - 1].nextCursor;
	const remaining = totalCount - allListings.length;

	return { allListings, totalCount, nextCursor, remaining };
}

function BrowsePage() {
	const { t } = useTranslation("listings");
	const search = Route.useSearch();
	const initialData = Route.useLoaderData();
	const navigate = useNavigate();

	const { currentUserId, makes } = initialData;
	const { allListings, totalCount, nextCursor, remaining } = useAccumulatedPages(
		initialData,
		search,
	);

	const hasQuery = !!search.q && search.q.trim().length > 0;
	const regionLabel = search.region
		? (REGIONS.find((r) => r.value === search.region)?.label ?? search.region)
		: t("browse.regionAll");

	const [drawerOpen, setDrawerOpen] = useState(false);
	const [mapVisible, setMapVisible] = useState(false);
	const isLoading = useRouterState({ select: (s) => s.isLoading });

	const activeFilterCount = countActiveFilters(search);

	const scrollToCard = useCallback((shortId: string) => {
		const el = document.querySelector(`[data-listing-id="${shortId}"]`);
		if (el) {
			// On mobile, switch to list view first
			setMapVisible(false);
			setTimeout(() => {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
				el.classList.add("ring-2", "ring-accent");
				setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 2000);
			}, 100);
		}
	}, []);

	function loadMore() {
		if (!nextCursor) {
			return;
		}
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ ...prev, cursor: nextCursor }),
			replace: true,
		});
	}

	function handleSearch(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = (formData.get("q") as string)?.trim() || undefined;
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ ...prev, q, cursor: undefined }),
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Search header */}
			<div className="bg-primary px-4 py-6">
				<div className="mx-auto max-w-6xl">
					<form onSubmit={handleSearch} data-testid="listings-search-form" className="flex gap-2">
						<input
							data-testid="listings-search-input"
							name="q"
							type="text"
							defaultValue={search.q ?? ""}
							placeholder={t("browse.searchPlaceholder")}
							className="h-11 flex-1 rounded-lg bg-white/10 px-4 text-sm text-white placeholder:text-white/70 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
						/>
						<button
							data-testid="listings-search-submit"
							type="submit"
							className="h-11 rounded-lg bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover"
						>
							{t("browse.searchButton")}
						</button>
						{/* Mobile filter button */}
						<button
							data-testid="listings-filter-drawer-toggle"
							type="button"
							onClick={() => setDrawerOpen(true)}
							className="relative h-11 rounded-lg bg-white/10 px-3 text-white lg:hidden"
							aria-label={t("browse.filterButtonAriaLabel")}
						>
							<SlidersHorizontal className="h-5 w-5" />
							{activeFilterCount > 0 && (
								<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
									{activeFilterCount}
								</span>
							)}
						</button>
						{/* Mobile map toggle */}
						<button
							type="button"
							onClick={() => setMapVisible((v) => !v)}
							className="h-11 rounded-lg bg-white/10 px-3 text-white lg:hidden"
							aria-label={t("browse.mapToggle")}
						>
							<MapIcon className="h-5 w-5" />
						</button>
					</form>
					<p
						data-testid="listings-result-count"
						aria-live="polite"
						className="mt-2 text-sm text-white/70"
					>
						<span data-testid="listings-total-count" className="font-semibold text-white">
							{totalCount}
						</span>{" "}
						{t("browse.resultCountWord")}
						{hasQuery ? <> {t("browse.resultCountQuery", { query: search.q ?? "" })}</> : null}
						{" — "}
						<span data-testid="listings-region-label">{regionLabel}</span>
					</p>
				</div>
			</div>

			{/* Main content */}
			<div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
				{/* Desktop sidebar */}
				<div className="hidden lg:block">
					<div className="sticky top-6">
						<FilterSidebar search={search} hasQuery={hasQuery} makes={makes} />
					</div>
				</div>

				{/* Results area */}
				<div className={`min-w-0 flex-1 ${mapVisible ? "hidden lg:block" : ""}`}>
					{allListings.length === 0 ? (
						<EmptyState search={search} />
					) : (
						<>
							<div
								data-testid="listings-grid"
								className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2"
							>
								{allListings.map((listing) => (
									<ListingCard
										key={listing.id}
										listing={listing}
										images={listing.images}
										makeSlug={listing.makeSlug}
										modelName={listing.modelName}
										isOwn={currentUserId !== null && listing.owner_id === currentUserId}
									/>
								))}
								{isLoading
									? ["skel-a", "skel-b", "skel-c"].map((key) => <ListingCardSkeleton key={key} />)
									: null}
							</div>

							{totalCount > 0 && totalCount <= 5 && <LowResultNudge />}

							{nextCursor && remaining > 0 && (
								<div className="mt-8 text-center">
									<button
										data-testid="listings-load-more"
										type="button"
										onClick={loadMore}
										disabled={isLoading}
										className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
									>
										{t("browse.loadMore", { remaining })}
									</button>
								</div>
							)}
						</>
					)}
				</div>

				{/* Map panel — desktop: sticky right column, mobile: full-width when toggled */}
				<div className={`${mapVisible ? "block" : "hidden"} lg:block lg:w-[420px] lg:shrink-0`}>
					<div className="sticky top-6 h-[70vh] lg:h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-border">
						<Suspense
							fallback={
								<div className="flex h-full items-center justify-center bg-muted-light text-sm text-muted">
									{t("browse.mapLoading")}
								</div>
							}
						>
							<ListingsMap listings={allListings} onPinClick={scrollToCard} />
						</Suspense>
					</div>
				</div>
			</div>

			{/* Mobile filter drawer */}
			<FilterDrawer
				search={search}
				hasQuery={hasQuery}
				totalCount={totalCount}
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				makes={makes}
			/>
		</div>
	);
}

function searchKeyWithoutCursor(search: BrowseSearchParams): string {
	const { cursor, ...rest } = search;
	return JSON.stringify(rest);
}
