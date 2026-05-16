import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { RentalFilters } from "~/components/listings/filter-compositions";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-search";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/pyorat/vuokraus/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => {
		const { view, city, ...deps } = search;
		return deps;
	},
	loader: async ({ deps }) => {
		const [result, session, makes] = await Promise.all([
			searchListings({ data: { ...deps, category: "rental" } }),
			getSession(),
			getMakes(),
		]);
		return { ...result, currentUserId: session?.user.id ?? null, makes };
	},
	head: () => ({
		meta: [
			{ title: `Moottoripyörien vuokraus — ${SITE_NAME}` },
			{ name: "description", content: "Vuokraa moottoripyörä suoraan omistajalta." },
			{ property: "og:url", content: `${SITE_URL}/pyorat/vuokraus` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/pyorat/vuokraus` }],
	}),
	component: RentalBrowsePage,
});

function RentalBrowsePage() {
	return (
		<BrowsePage
			initialData={Route.useLoaderData()}
			search={Route.useSearch()}
			browseTo="/pyorat/vuokraus"
			showMap={true}
			filterBlocks={<RentalFilters />}
		/>
	);
}
