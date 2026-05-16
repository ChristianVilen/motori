import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { PartsFilters } from "~/components/listings/filter-compositions";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-search";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/varaosat/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => {
		const { view, city, ...deps } = search;
		return deps;
	},
	loader: async ({ deps }) => {
		const [result, session, makes] = await Promise.all([
			searchListings({ data: { ...deps, category: "part" } }),
			getSession(),
			getMakes(),
		]);
		return { ...result, currentUserId: session?.user.id ?? null, makes };
	},
	head: () => ({
		meta: [
			{ title: `Moottoripyörän varaosat — ${SITE_NAME}` },
			{ name: "description", content: "Osta ja myy moottoripyörän varaosia." },
			{ property: "og:url", content: `${SITE_URL}/varaosat` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/varaosat` }],
	}),
	component: PartsBrowsePage,
});

function PartsBrowsePage() {
	return (
		<BrowsePage
			initialData={Route.useLoaderData()}
			search={Route.useSearch()}
			browseTo="/varaosat"
			showMap={false}
			filterBlocks={<PartsFilters />}
		/>
	);
}
