import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage } from "~/components/listings/browse-page";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { searchListings } from "~/lib/listings-queries";
import { getMakes } from "~/lib/makes";
import { getSession } from "~/lib/session";
import { browseSearchSchema } from "~/lib/validators";

export const Route = createFileRoute("/pyorat/myynti/")({
	validateSearch: (search) => browseSearchSchema.parse(search),
	loaderDeps: ({ search }) => {
		const { view, city, ...deps } = search;
		return deps;
	},
	loader: async ({ deps }) => {
		const [result, session, makes] = await Promise.all([
			searchListings({ data: { ...deps, category: "sale" } }),
			getSession(),
			getMakes(),
		]);
		return { ...result, currentUserId: session?.user.id ?? null, makes };
	},
	head: () => ({
		meta: [
			{ title: `Moottoripyörät myytävänä — ${SITE_NAME}` },
			{ name: "description", content: "Osta käytetty tai uusi moottoripyörä suoraan omistajalta." },
			{ property: "og:url", content: `${SITE_URL}/pyorat/myynti` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/pyorat/myynti` }],
	}),
	component: SaleBrowsePage,
});

function SaleBrowsePage() {
	return (
		<BrowsePage
			initialData={Route.useLoaderData()}
			search={Route.useSearch()}
			browseTo="/pyorat/myynti"
			showMap={true}
		/>
	);
}
