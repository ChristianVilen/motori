import { useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { lazy, Suspense, useCallback, useState } from "react";
import { ClientOnly } from "~/components/client-only";
import { EmptyState, LowResultNudge } from "~/components/listings/empty-state";
import { FeedBar } from "~/components/listings/feed-bar";
import { FilterDrawer } from "~/components/listings/filter-drawer";
import { ListingCard } from "~/components/listings/listing-card";
import { ListingCardSkeleton } from "~/components/listings/listing-card-skeleton";
import { SaveSearchButton } from "~/components/listings/save-search-button";
import { REGIONS } from "~/lib/constants";
import type { MotorcycleMake } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import type { ListingWithImages, SearchCategory, SearchResult } from "~/lib/listings-search";
import { type BrowseSearchParams, countActiveFilters } from "~/lib/validators";
import { ActiveFilterChips } from "./active-filter-chips";
import { useListingPages } from "./use-listing-pages";

const ListingsMap = lazy(() =>
	import("~/components/listings/listings-map").then((m) => ({ default: m.ListingsMap })),
);

export interface BrowsePageProps {
	initialData: SearchResult & { makes?: MotorcycleMake[] };
	search: BrowseSearchParams;
	browseTo: string;
	category: SearchCategory;
	children?: React.ReactNode;
	showMap?: boolean;
	filterBlocks: React.ReactNode;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page component with conditional view rendering
export function BrowsePage({
	initialData,
	search,
	browseTo,
	category,
	showMap = true,
	filterBlocks,
	children,
}: BrowsePageProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	const { session } = useRouteContext({ from: "__root__" });
	const currentUserId = session?.user.id ?? null;
	const makes = initialData.makes ?? [];
	const { allListings, loadMore, remaining } = useListingPages(
		initialData,
		search.cursor,
		browseTo,
	);
	const totalCount =
		initialData.mapCities?.reduce((sum, city) => sum + city.count, 0) ?? initialData.totalCount;

	const hasQuery = !!search.q && search.q.trim().length > 0;
	const regionLabel = search.region
		? (REGIONS.find((r) => r.value === search.region)?.label ?? search.region)
		: t("browse.regionAll");

	const [drawerOpen, setDrawerOpen] = useState(false);
	const view = showMap ? (search.view ?? "list") : "list";
	const selectedCity = search.city ?? null;
	const isLoading = useRouterState({ select: (s) => s.isLoading });

	const activeFilterCount = countActiveFilters(search) + (!showMap && search.city ? 1 : 0);

	const handleCityClick = useCallback(
		(city: string) => {
			navigate({
				to: browseTo,
				search: (prev) => ({ ...prev, view: "map" as const, city, cursor: undefined }),
			});
		},
		[navigate, browseTo],
	);

	const clearCitySelection = useCallback(() => {
		navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, city: undefined, cursor: undefined }),
		});
	}, [navigate, browseTo]);

	function renderCard(listing: ListingWithImages) {
		return (
			<ListingCard
				key={listing.id}
				listing={listing}
				images={listing.images}
				makeSlug={listing.makeSlug}
				modelName={listing.modelName}
				isOwn={listing.owner_id === currentUserId}
			/>
		);
	}

	const moreButton = remaining > 0 && (
		<div className="mt-8 text-center">
			<button
				data-testid="listings-load-more"
				type="button"
				onClick={loadMore}
				disabled={isLoading}
				className="min-h-11 rounded-full border border-foreground bg-card px-6 py-2 text-sm font-semibold text-foreground hover:bg-muted-light disabled:opacity-50"
			>
				{t("browse.loadMore", { remaining })}
			</button>
		</div>
	);
	return (
		<div className={showMap && view === "map" ? "browse-map-page" : "min-h-[60vh]"}>
			<FeedBar
				category={category}
				browseTo={browseTo}
				showMap={showMap}
				filterCount={activeFilterCount}
				onFilter={() => setDrawerOpen(true)}
				search={search}
			/>

			{activeFilterCount > 0 && (
				<ActiveFilterChips
					search={search}
					makes={makes}
					browseTo={browseTo}
					cityFilter={!showMap}
				/>
			)}
			<div className="mx-auto w-full max-w-[1304px] px-4 lg:px-8">
				<div className="mt-4 mb-3.5 grid grid-cols-[1fr_auto] items-center gap-x-3 md:flex md:flex-wrap">
					<h1
						data-testid={category === "all" ? "home-feed-heading" : undefined}
						className="col-span-2 font-heading text-[22px] font-bold leading-tight tracking-tight md:text-2xl"
					>
						{t(hasQuery || activeFilterCount ? "home:results" : "home:latest")}
					</h1>
					<p
						data-testid="listings-result-count"
						className="min-w-0 text-sm text-muted tabular-nums md:mr-auto"
					>
						<span data-testid="listings-total-count" aria-live="polite">
							{t("home:count", { count: totalCount })}
						</span>{" "}
						· <span data-testid="listings-region-label">{regionLabel}</span>
					</p>
					<SaveSearchButton
						category={category}
						search={search}
						enabled={hasQuery || activeFilterCount > 0}
					/>
				</div>
			</div>
			{!showMap || view === "list" ? (
				<div className="mx-auto w-full max-w-[1304px] px-4 pb-8 lg:px-8">
					<div className="min-w-0 flex-1">
						{allListings.length === 0 ? (
							<EmptyState search={search} browseTo={browseTo} />
						) : (
							<>
								<div data-feed-grid data-testid="listings-grid" className="listing-grid">
									{allListings.map(renderCard)}
									{isLoading
										? ["skel-a", "skel-b", "skel-c"].map((key) => <ListingCardSkeleton key={key} />)
										: null}
								</div>

								{totalCount > 0 && totalCount <= 5 && <LowResultNudge />}

								{moreButton}
							</>
						)}
					</div>
				</div>
			) : (
				<div className="mx-auto flex min-h-0 w-full max-w-[1304px] flex-1 flex-col gap-4 px-4 pb-4 md:flex-row lg:px-8">
					<div className="relative isolate min-h-[clamp(18rem,50dvh,34rem)] flex-1 overflow-hidden rounded-lg md:min-h-0">
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
									className="absolute inset-0"
									cities={initialData.mapCities ?? []}
									onCityClick={handleCityClick}
									selectedCity={selectedCity}
								/>
							</Suspense>
						</ClientOnly>
					</div>
					{!!selectedCity && (
						<div
							data-testid="map-city-panel"
							className="min-w-0 shrink-0 md:order-first md:w-[360px] md:overflow-y-auto md:pr-1"
						>
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-heading text-lg font-bold">
									{selectedCity} · {t("home:count", { count: initialData.totalCount })}
								</h2>
								<button
									type="button"
									onClick={clearCitySelection}
									className="grid size-11 place-items-center rounded-full border border-border bg-card text-muted hover:bg-muted-light hover:text-foreground"
									aria-label={t("browse.closeCityPanel")}
									data-testid="map-city-panel-close"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<div className="grid grid-cols-2 gap-x-2.5 gap-y-[22px]">
								{allListings.map(renderCard)}
							</div>
							{moreButton}
						</div>
					)}
				</div>
			)}

			{children}
			{drawerOpen ? (
				<FilterDrawer
					search={search}
					totalCount={totalCount}
					onClose={() => setDrawerOpen(false)}
					makes={makes}
					browseTo={browseTo}
				>
					{filterBlocks}
				</FilterDrawer>
			) : null}
		</div>
	);
}
