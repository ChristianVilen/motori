import { createFileRoute } from "@tanstack/react-router";
import { NonRentalSidebar } from "~/components/listings/non-rental-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { defineCategoryDetailRoute } from "~/lib/listings-detail-route";
import { slugify } from "~/lib/slug";

const CONDITION_LABELS: Record<string, string> = {
	new: "Uusi",
	excellent: "Erinomainen",
	good: "Hyvä",
	fair: "Tyydyttävä",
	poor: "Huono",
};
const GEAR_TYPE_LABELS: Record<string, string> = {
	helmet: "Kypärä",
	jacket: "Takki",
	pants: "Housut",
	boots: "Saappaat",
	gloves: "Käsineet",
	other: "Muu",
};

const { loader, head, component, notFoundComponent } = defineCategoryDetailRoute({
	category: "gear",
	backTo: "/varusteet",
	Sidebar: ({ data, isOwner }) => {
		const g = data.gear as NonNullable<typeof data.gear>;
		return (
			<NonRentalSidebar
				price={g.price}
				priceTestId="price-gear"
				statRows={[
					{ label: "Tyyppi", value: GEAR_TYPE_LABELS[g.gear_type] ?? g.gear_type },
					...(g.size ? [{ label: "Koko", value: g.size }] : []),
					{ label: "Kunto", value: CONDITION_LABELS[g.condition] ?? g.condition },
				]}
				listing={data.listing}
				isOwner={isOwner}
				ownerPhoneVisible={data.ownerContact.showPhone}
				ownerPhone={data.ownerContact.phone}
				ownerUserId={data.listing.owner_id}
			/>
		);
	},
	head: (loaderData) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const price = loaderData?.gear?.price ?? 0;
		const url = `${SITE_URL}/varusteet/${l.short_id}/${slugify(l.title)}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään varuste: ${l.title} — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:url", content: url },
			],
			links: [{ rel: "canonical", href: url }],
		};
	},
});

export const Route = createFileRoute("/varusteet/$listingId_/$slug")({
	loader,
	head,
	component,
	notFoundComponent,
});
