import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-queries";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/varusteet/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => {
		const { view, city, ...deps } = search;
		return deps;
	},
	loader: async ({ deps }) => {
		const [result, session, makes] = await Promise.all([
			searchListings({ data: { ...deps, category: "gear" } }),
			getSession(),
			getMakes(),
		]);
		return { ...result, currentUserId: session?.user.id ?? null, makes };
	},
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
			category="gear"
			initialData={Route.useLoaderData()}
			search={Route.useSearch()}
			browseTo="/varusteet"
			showMap={true}
		/>
	);
}
