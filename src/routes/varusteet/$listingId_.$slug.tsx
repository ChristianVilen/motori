import { createFileRoute } from "@tanstack/react-router";
import { GearDetailSidebar } from "~/components/listings/gear-detail-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { defineCategoryDetailRoute } from "~/lib/listings-detail-route";
import { slugify } from "~/lib/slug";

const { loader, head, component, notFoundComponent } = defineCategoryDetailRoute({
	category: "gear",
	backTo: "/varusteet",
	Sidebar: ({ data, isOwner }) => (
		<GearDetailSidebar
			listing={data.listing}
			gear={data.gear!}
			isOwner={isOwner}
			ownerPhoneVisible={data.ownerContact.showPhone}
			ownerPhone={data.ownerContact.phone}
			ownerUserId={data.listing.owner_id}
		/>
	),
	head: (loaderData) => {
		const l = loaderData?.listing;
		if (!l) return {};
		const price = loaderData?.gear?.price ?? 0;
		const url = `${SITE_URL}/varusteet/${l.short_id}/${slugify(l.title)}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään varuste: ${l.title} — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
		return {
			meta: [{ title }, { name: "description", content: desc }, { property: "og:url", content: url }],
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
