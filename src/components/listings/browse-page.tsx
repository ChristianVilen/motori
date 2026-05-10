import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Grid3x3, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { ClientOnly } from "~/components/client-only";
import { CollapsibleSidebar } from "~/components/listings/collapsible-sidebar";
import { EmptyState, LowResultNudge } from "~/components/listings/empty-state";
import { FilterDrawer } from "~/components/listings/filter-drawer";
import { FilterSidebar } from "~/components/listings/filter-sidebar";
import { ListingCard } from "~/components/listings/listing-card";
import { ListingCardSkeleton } from "~/components/listings/listing-card-skeleton";
import { REGIONS } from "~/lib/constants";
import type { ListingCategory, MotorcycleMake } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import type { SearchResult } from "~/lib/listings-queries";
import { type BrowseSearchParams, countActiveFilters } from "~/lib/validators";

const ListingsMap = lazy(() =>
	import("~/components/listings/listings-map").then((m) => ({ default: m.ListingsMap })),
);

export interface BrowsePageProps {
	category: ListingCategory;
	initialData: SearchResult & { currentUserId: string | null; makes: MotorcycleMake[] };
	search: BrowseSearchParams;
	browseTo: string;
	showMap?: boolean;
}

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

function searchKeyWithoutCursor(search: BrowseSearchParams): string {
	const { cursor, ...rest } = search;
	return JSON.stringify(rest);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page component with conditional view rendering
export function BrowsePage({
	category,
	initialData,
	search,
	browseTo,
	showMap = true,
}: BrowsePageProps) {
	const { t } = useTranslation("listings");
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
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const view = search.view ?? "list";
	const selectedCity = search.city ?? null;
	const isLoading = useRouterState({ select: (s) => s.isLoading });

	const activeFilterCount = countActiveFilters(search);

	const cityListings = useMemo(() => {
		if (!selectedCity) {
			return [];
		}
		return allListings.filter((l) => l.city === selectedCity);
	}, [allListings, selectedCity]);

	const handleCityClick = useCallback(
		(city: string, _listingIds: string[]) => {
			navigate({
				to: browseTo,
				search: (prev) => ({ ...prev, view: "map" as const, city }),
			});
		},
		[navigate, browseTo],
	);

	const clearCitySelection = useCallback(() => {
		navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, city: undefined }),
		});
	}, [navigate, browseTo]);

	function loadMore() {
		if (!nextCursor) {
			return;
		}
		navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, cursor: nextCursor }),
			replace: true,
		});
	}

	function handleSearch(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = (formData.get("q") as string)?.trim() || undefined;
		navigate({
			to: browseTo,
			search: (prev: BrowseSearchParams) => ({ ...prev, q, cursor: undefined }),
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Search header */}
			<div className={`bg-primary px-4 ${view === "map" ? "py-3" : "py-6"}`}>
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
						{/* Filter button (mobile only) */}
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
						{/* View toggle — only shown if showMap is true */}
						{showMap && (
							<button
								type="button"
								onClick={() => {
									navigate({
										to: browseTo,
										search: (prev: BrowseSearchParams) => ({
											...prev,
											view: view === "list" ? ("map" as const) : undefined,
											city: undefined,
										}),
									});
								}}
								className="flex h-11 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm text-white hover:bg-white/15"
								aria-label={view === "list" ? t("browse.mapToggle") : t("browse.listToggle")}
								data-testid="listings-view-toggle"
							>
								{view === "list" ? (
									<MapIcon className="h-5 w-5" />
								) : (
									<Grid3x3 className="h-5 w-5" />
								)}
								<span className="hidden sm:inline">
									{view === "list" ? t("browse.mapToggle") : t("browse.listToggle")}
								</span>
							</button>
						)}
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
			{!showMap || view === "list" ? (
				<div className="mx-auto flex max-w-6xl gap-8 px-4 py-6">
					{/* Desktop sidebar */}
					<div className="hidden lg:block">
						<div className="sticky top-6">
							<div
								className={`overflow-hidden transition-all duration-300 ${sidebarOpen ? "w-[280px]" : "w-10"}`}
							>
								<CollapsibleSidebar open={sidebarOpen} onToggle={setSidebarOpen}>
									<FilterSidebar
										search={search}
										hasQuery={hasQuery}
										makes={makes}
										browseTo={browseTo}
									/>
								</CollapsibleSidebar>
							</div>
						</div>
					</div>

					{/* Results grid */}
					<div className="min-w-0 flex-1">
						{allListings.length === 0 ? (
							<EmptyState search={search} />
						) : (
							<>
								<div
									data-testid="listings-grid"
									className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
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
				</div>
			) : (
				/* Map view */
				<div className="flex h-[calc(100vh-10rem)] flex-col lg:flex-row">
					{/* Collapsible filter sidebar — desktop only */}
					<div className="hidden shrink-0 lg:flex lg:flex-col">
						<div
							className={`flex-1 overflow-y-auto border-r border-border bg-background transition-all duration-300 ${sidebarOpen ? "w-[280px] p-4" : "w-10 p-0"}`}
						>
							<CollapsibleSidebar
								open={sidebarOpen}
								onToggle={setSidebarOpen}
								collapsedHeight="full"
							>
								<FilterSidebar
									search={search}
									hasQuery={hasQuery}
									makes={makes}
									browseTo={browseTo}
								/>
							</CollapsibleSidebar>
						</div>
					</div>

					{/* City listings panel — shows when a pin is clicked */}
					{selectedCity && cityListings.length > 0 && (
						<div
							data-testid="map-city-panel"
							className="relative z-[500] max-h-[40vh] w-full shrink-0 overflow-y-auto border-b border-border bg-background p-4 lg:max-h-none lg:w-[360px] lg:border-r lg:border-b-0"
						>
							<div className="mb-3 flex items-center justify-between">
								<h3 className="text-sm font-semibold text-foreground">
									{selectedCity}{" "}
									<span className="font-normal text-muted">({cityListings.length})</span>
								</h3>
								<button
									type="button"
									onClick={clearCitySelection}
									className="rounded-md p-1 text-muted hover:bg-muted-light hover:text-foreground"
									aria-label={t("browse.closeCityPanel")}
									data-testid="map-city-panel-close"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="flex flex-col gap-3">
								{cityListings.map((listing) => (
									<ListingCard
										key={listing.id}
										listing={listing}
										images={listing.images}
										makeSlug={listing.makeSlug}
										modelName={listing.modelName}
										isOwn={currentUserId !== null && listing.owner_id === currentUserId}
									/>
								))}
							</div>
						</div>
					)}

					{/* Map */}
					<div className="min-h-[50vh] flex-1">
						<ClientOnly
							fallback={
								<div className="flex h-full items-center justify-center bg-muted-light text-sm text-muted">
									{t("browse.mapLoading")}
								</div>
							}
						>
							<Suspense
								fallback={
									<div className="flex h-full items-center justify-center bg-muted-light text-sm text-muted">
										{t("browse.mapLoading")}
									</div>
								}
							>
								<ListingsMap
									listings={allListings}
									onCityClick={handleCityClick}
									selectedCity={selectedCity}
								/>
							</Suspense>
						</ClientOnly>
					</div>
				</div>
			)}

			{/* Mobile filter drawer */}
			<FilterDrawer
				search={search}
				hasQuery={hasQuery}
				totalCount={totalCount}
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				makes={makes}
				browseTo={browseTo}
			/>
		</div>
	);
}
