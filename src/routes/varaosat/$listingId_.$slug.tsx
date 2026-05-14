import { createFileRoute } from "@tanstack/react-router";
import { NonRentalSidebar } from "~/components/listings/non-rental-sidebar";
import { CONDITION_LABELS, SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { defineCategoryDetailRoute } from "~/lib/listings-detail-route";
import { slugify } from "~/lib/slug";

const { loader, head, component, notFoundComponent } = defineCategoryDetailRoute({
	category: "part",
	backTo: "/varaosat",
	Sidebar: ({ data, isOwner }) => {
		const p = data.part as NonNullable<typeof data.part>;
		return (
			<NonRentalSidebar
				price={p.price}
				priceTestId="price-part"
				statRows={[
					{ label: "Osatyyppi", value: p.part_category },
					{ label: "Kunto", value: CONDITION_LABELS[p.condition] ?? p.condition },
				]}
				listing={data.listing}
				isOwner={isOwner}
				ownerPhoneVisible={data.ownerContact.showPhone}
				ownerPhone={data.ownerContact.phone}
				ownerUserId={data.listing.owner_id}
				currentUserId={data.session?.user.id}
			/>
		);
	},
	head: (loaderData) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const price = loaderData?.part?.price ?? 0;
		const url = `${SITE_URL}/varaosat/${l.short_id}/${slugify(l.title)}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään varaosa: ${l.title} — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
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

export const Route = createFileRoute("/varaosat/$listingId_/$slug")({
	loader,
	head,
	component,
	notFoundComponent,
});
