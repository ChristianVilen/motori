// src/routes/profile/$userId.tsx
// Public user profile — display name, location, license, and their active listings.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { ListingCard } from "~/components/listings/listing-card";
import { LICENSE_CLASSES } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { ListingImage } from "~/lib/db/schema";

const getPublicProfile = createServerFn({ method: "GET" })
	.inputValidator((userId: string) => userId)
	.handler(async ({ data: userId }) => {
		const profile = await db
			.selectFrom("profile")
			.select(["user_id", "display_name", "city", "license_class", "created_at"])
			.where("user_id", "=", userId)
			.executeTakeFirst();

		if (!profile) {
			return null;
		}

		const listings = await db
			.selectFrom("listing")
			.selectAll()
			.where("owner_id", "=", userId)
			.where("status", "=", "active")
			.orderBy("created_at", "desc")
			.execute();

		const listingIds = listings.map((l) => l.id);
		const images =
			listingIds.length > 0
				? await db
						.selectFrom("listing_image")
						.selectAll()
						.where("listing_id", "in", listingIds)
						.orderBy("order", "asc")
						.execute()
				: [];

		return { profile, listings, images };
	});

export const Route = createFileRoute("/profile/$userId")({
	loader: async ({ params }) => {
		const result = await getPublicProfile({ data: params.userId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	component: PublicProfilePage,
	notFoundComponent: () => (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
			<p className="text-muted">Käyttäjää ei löydy.</p>
			<Link to="/" className="text-sm text-accent underline">
				Etusivulle
			</Link>
		</div>
	),
});

function PublicProfilePage() {
	const { profile, listings, images } = Route.useLoaderData();
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === profile.license_class)?.label ?? null;

	const imagesByListing = new Map<string, ListingImage[]>();
	for (const img of images) {
		const arr = imagesByListing.get(img.listing_id) ?? [];
		arr.push(img);
		imagesByListing.set(img.listing_id, arr);
	}

	const memberSince = new Date(profile.created_at).toLocaleDateString("fi-FI", {
		year: "numeric",
		month: "long",
	});

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-5xl px-4 py-8">
				{/* Header */}
				<div className="mb-8 rounded-xl border border-border bg-card p-6">
					<h1 className="text-2xl font-bold text-primary">{profile.display_name}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
						{!!profile.city && (
							<span className="flex items-center gap-1">
								<MapPin className="h-3 w-3" />
								{profile.city}
							</span>
						)}
						{!!licenseLabel && (
							<span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
								Kortti {licenseLabel}
							</span>
						)}
						<span>Jäsen {memberSince} alkaen</span>
					</div>
				</div>

				{/* Listings */}
				<h2 className="mb-4 text-sm font-semibold text-foreground">
					Ilmoitukset ({listings.length})
				</h2>
				{listings.length === 0 ? (
					<p className="text-sm text-muted">Ei aktiivisia ilmoituksia.</p>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{listings.map((listing) => (
							<ListingCard
								key={listing.id}
								listing={listing}
								images={imagesByListing.get(listing.id) ?? []}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
