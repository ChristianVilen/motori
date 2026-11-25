import { createFileRoute, Link } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { AllFilters } from "~/components/listings/filter-compositions";
import { SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { searchListings } from "~/lib/listings-search";
import { allBrowseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/")({
	validateSearch: (input) => allBrowseSearchSchema.parse(input),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => searchListings({ data: { ...deps, category: "all" } }),
	head: () => ({ links: [{ rel: "canonical", href: `${SITE_URL}/` }] }),
	component: HomePage,
});

function HomePage() {
	const { t } = useTranslation("home");
	const { t: tAuth } = useTranslation("auth");
	const { session } = Route.useRouteContext();
	const search = Route.useSearch();
	const data = Route.useLoaderData();
	const verified = session?.user.emailVerified ?? true;
	const action =
		"inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-card px-5 text-sm font-semibold hover:bg-muted-light";
	return (
		<BrowsePage
			initialData={data}
			search={search}
			browseTo="/"
			category="all"
			showMap={false}
			filterBlocks={<AllFilters />}
		>
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
		</BrowsePage>
	);
}
