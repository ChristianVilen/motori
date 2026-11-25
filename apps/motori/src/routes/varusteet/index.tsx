import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { GearFilters } from "~/components/listings/filter-compositions";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-search";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/varusteet/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => searchListings({ data: { ...deps, category: "gear" } }),
	head: () => ({
		meta: [
			{ title: `Moottoripyörävarusteet — ${SITE_NAME}` },
			{ name: "description", content: "Osta ja myy moottoripyörävarusteita." },
			{ property: "og:url", content: `${SITE_URL}/varusteet` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/varusteet` }],
	}),
	component: GearBrowsePage,
});

function GearBrowsePage() {
	return (
		<BrowsePage
			initialData={Route.useLoaderData()}
			search={Route.useSearch()}
			browseTo="/varusteet"
			category="gear"
			showMap={false}
			filterBlocks={<GearFilters />}
		/>
	);
}
