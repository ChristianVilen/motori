// src/routes/omat/suosikit.tsx
// Favorites watchlist — sold/expired stay with their status badge, removed drop out.
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ListingCard } from "~/components/listings/listing-card";
import { SITE_NAME } from "~/lib/constants";
import type { ListingImage } from "~/lib/db/schema";
import { getFavoriteListingsFn } from "~/lib/favorites-fns";
import { useTranslation } from "~/lib/i18n";
import { requireSessionOrRedirect } from "~/lib/session";

export const Route = createFileRoute("/omat/suosikit")({
	loader: async ({ location }) => {
		await requireSessionOrRedirect(location.pathname);
		return getFavoriteListingsFn();
	},
	head: () => ({ meta: [{ title: `Suosikit — ${SITE_NAME}` }] }),
	component: FavoritesPage,
});

function FavoritesPage() {
	const { listings, images } = Route.useLoaderData();
	const { t } = useTranslation("profile");

	const imagesByListing = new Map<string, ListingImage[]>();
	for (const img of images) {
		const arr = imagesByListing.get(img.listing_id) ?? [];
		arr.push(img);
		imagesByListing.set(img.listing_id, arr);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-5xl px-4 py-8">
				<Link
					to="/omat"
					className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("favorites.back")}
				</Link>

				<h1 className="mb-6 text-2xl font-bold text-primary">{t("favorites.title")}</h1>

				{listings.length === 0 ? (
					<div className="rounded-l border border-dashed border-border py-16 text-center">
						<p className="text-muted">{t("favorites.empty")}</p>
					</div>
				) : (
					<div
						data-testid="favorites-grid"
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
					>
						{listings.map((listing) => (
							<ListingCard
								key={listing.id}
								listing={{ ...listing, price: listing.price ?? undefined }}
								images={imagesByListing.get(listing.id) ?? []}
								makeSlug={listing.makeSlug}
								modelName={listing.modelName}
								showStatus
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
