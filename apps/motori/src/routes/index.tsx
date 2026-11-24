import { createFileRoute, Link } from "@tanstack/react-router";
import { categoryChipClass } from "~/components/category-chip-class";
import { ListingCard } from "~/components/listings/listing-card";
import { useListingPages } from "~/components/listings/use-listing-pages";
import { BROWSE_CATEGORIES, SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { searchListings } from "~/lib/listings-search";
import { browseSearchSchema } from "~/lib/validators";

const allSearch = browseSearchSchema.pick({
	q: true,
	region: true,
	city: true,
	price_min: true,
	price_max: true,
	condition: true,
	sort: true,
	cursor: true,
});

export const Route = createFileRoute("/")({
	validateSearch: (input) => allSearch.parse(input),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => searchListings({ data: { ...deps, category: "all" } }),
	head: () => ({ links: [{ rel: "canonical", href: `${SITE_URL}/` }] }),
	component: HomePage,
});

function HomePage() {
	const { t } = useTranslation("home");
	const { t: tListings } = useTranslation("listings");
	const { t: tAuth } = useTranslation("auth");
	const { session } = Route.useRouteContext();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const data = Route.useLoaderData();
	const { allListings, nextCursor, remaining, totalCount } = useListingPages(data, search);
	const filtered = !!(
		search.q ||
		search.region ||
		search.city ||
		search.condition ||
		search.price_min != null ||
		search.price_max != null
	);
	const verified = session?.user.emailVerified ?? true;
	const action =
		"inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-card px-5 text-sm font-semibold hover:bg-muted-light";
	return (
		<div className="mx-auto max-w-[1304px] px-4 pb-8 lg:px-8">
			<nav
				aria-label={t("common:nav.search.categories")}
				className="flex gap-2 overflow-x-auto py-3"
			>
				{BROWSE_CATEGORIES.map((c) => (
					<Link
						key={c.to}
						to={c.to}
						search={{ q: search.q, region: search.region }}
						aria-current={c.value === "all" ? "page" : undefined}
						data-testid={`home-category-${c.value}`}
						className={`${categoryChipClass(c.value === "all")} inline-flex h-10 items-center`}
					>
						{tListings(`browse.categoryChips.${c.value}`)}
					</Link>
				))}
			</nav>
			<div className="mt-4 mb-5 flex flex-col gap-y-1 md:flex-row md:items-baseline md:gap-x-3">
				<h1
					data-testid="home-feed-heading"
					className="font-heading text-[22px] leading-tight font-bold tracking-tight md:text-2xl"
				>
					{t(filtered ? "results" : "latest")}
				</h1>
				<p aria-live="polite" data-testid="listings-total-count" className="text-sm text-muted">
					{t("count", { count: totalCount })}
				</p>
			</div>
			{search.city ? (
				<button
					type="button"
					data-testid="clear-city"
					aria-label={tListings("filters.removeChipAriaLabel", { label: search.city })}
					className="mb-4 rounded-full bg-muted-light px-4 py-2 text-sm"
					onClick={() =>
						navigate({ search: (prev) => ({ ...prev, city: undefined, cursor: undefined }) })
					}
				>
					{search.city} <span aria-hidden="true">×</span>
				</button>
			) : null}
			{allListings.length > 0 ? (
				<div data-testid="listings-grid" className="listing-grid">
					{allListings.map((l) => (
						<ListingCard
							key={l.id}
							listing={l}
							images={l.images}
							makeSlug={l.makeSlug}
							modelName={l.modelName}
							isOwn={l.owner_id === session?.user.id}
						/>
					))}
				</div>
			) : (
				<p data-testid="listings-empty-state" className="py-10 text-muted">
					{t("empty")}
				</p>
			)}
			{nextCursor !== null && (
				<div className="mt-8 text-center">
					<button
						type="button"
						data-testid="listings-load-more"
						className={action}
						onClick={() =>
							navigate({
								search: (prev) => ({ ...prev, cursor: nextCursor }),
								replace: true,
								resetScroll: false,
							})
						}
					>
						{tListings("browse.loadMore", { remaining })}
					</button>
				</div>
			)}
			<div className="mt-10 border-t border-border pt-5 text-center">
				{verified ? (
					<Link data-testid="home-add-listing-cta" to="/ilmoitukset/uusi" className={action}>
						{t("addListing")}
					</Link>
				) : (
					<span
						aria-disabled="true"
						data-testid="home-add-listing-cta"
						title={tAuth("unverifiedTooltip")}
						className="inline-flex min-h-11 items-center rounded-full border border-border px-5 text-muted"
					>
						{t("addListing")}
					</span>
				)}
			</div>
		</div>
	);
}
