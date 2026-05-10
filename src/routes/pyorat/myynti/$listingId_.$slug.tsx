import { createFileRoute } from "@tanstack/react-router";
import { NonRentalSidebar } from "~/components/listings/non-rental-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { defineCategoryDetailRoute } from "~/lib/listings-detail-route";
import { computeListingSlug } from "~/lib/slug";

const CONDITION_LABELS: Record<string, string> = {
	new: "Uusi",
	excellent: "Erinomainen",
	good: "Hyvä",
	fair: "Tyydyttävä",
	poor: "Huono",
};

const { loader, head, component, notFoundComponent } = defineCategoryDetailRoute({
	category: "sale",
	backTo: "/pyorat/myynti",
	Sidebar: ({ data, isOwner }) => {
		const s = data.sale as NonNullable<typeof data.sale>;
		return (
			<NonRentalSidebar
				price={s.price}
				priceTestId="price-sale"
				negotiable={s.negotiable}
				statRows={[
					{ label: "Kunto", value: CONDITION_LABELS[s.condition] ?? s.condition },
					...(s.km_driven != null
						? [{ label: "Kilometrit", value: `${s.km_driven.toLocaleString("fi")} km` as const }]
						: []),
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
		const price = loaderData?.sale?.price ?? 0;
		const slug = computeListingSlug(
			loaderData?.makeSlug ?? null,
			loaderData?.modelName ?? null,
			l.city,
		);
		const url = `${SITE_URL}/pyorat/myynti/${l.short_id}/${slug}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään ${loaderData?.makeName ?? ""} ${loaderData?.modelName ?? ""} (${l.year ?? ""}) — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
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

export const Route = createFileRoute("/pyorat/myynti/$listingId_/$slug")({
	loader,
	head,
	component,
	notFoundComponent,
});
