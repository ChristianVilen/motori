// src/routes/profiili/$userId.tsx
// Public user profile — display name, location, license, and their active listings.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin } from "lucide-react";
import { ListingCard } from "~/components/listings/listing-card";
import { ReportButton } from "~/components/report-button";
import { SITE_NAME } from "~/lib/constants";
import type { ListingImage } from "~/lib/db/schema";
import { formatDate, useTranslation } from "~/lib/i18n";
import { getPublicProfile } from "~/lib/profile.server";
import { getSession } from "~/lib/session";

const getPublicProfileFn = createServerFn({ method: "GET" })
	.inputValidator((userId: string) => userId)
	.handler(async ({ data: userId }) => getPublicProfile(userId));

function NotFoundProfile() {
	const { t } = useTranslation("profile");
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
			<p className="text-muted">{t("publicProfile.notFound")}</p>
			<Link to="/" className="text-sm text-accent underline">
				{t("publicProfile.notFoundBack")}
			</Link>
		</div>
	);
}

export const Route = createFileRoute("/profiili/$userId")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getPublicProfileFn({ data: params.userId }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		return { ...result, session };
	},
	head: ({ loaderData }) => {
		const name = loaderData?.profile?.display_name;
		return {
			meta: [{ title: name ? `${name} — ${SITE_NAME}` : `Profiili — ${SITE_NAME}` }],
		};
	},
	component: PublicProfilePage,
	notFoundComponent: NotFoundProfile,
});

function PublicProfilePage() {
	const { t } = useTranslation("profile");
	const { profile, listings, images, session, reviewSummary, reviews } = Route.useLoaderData();
	const isOwnProfile = session?.user.id === profile.user_id;
	const imagesByListing = new Map<string, ListingImage[]>();
	for (const img of images) {
		const arr = imagesByListing.get(img.listing_id) ?? [];
		arr.push(img);
		imagesByListing.set(img.listing_id, arr);
	}

	const memberSince = formatDate(new Date(profile.created_at), {
		year: "numeric",
		month: "long",
	});

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-5xl px-4 py-8">
				<Link
					to="/ilmoitukset"
					className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("publicProfile.back")}
				</Link>

				{/* Header */}
				<div className="mb-8 rounded-l border border-border bg-card p-6">
					<h1 className="text-2xl font-bold text-primary">{profile.display_name}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
						{!!profile.city && (
							<span className="flex items-center gap-1">
								<MapPin className="h-3 w-3" />
								{profile.city}
							</span>
						)}
						<span>{t("publicProfile.memberSince", { date: memberSince })}</span>
						{reviewSummary.averageRating !== null && (
							<span className="font-medium text-foreground">
								{reviewSummary.reviewCount === 1
									? t("reviews.summaryOne", { rating: reviewSummary.averageRating })
									: t("reviews.summary", {
											rating: reviewSummary.averageRating,
											count: reviewSummary.reviewCount,
										})}
							</span>
						)}
					</div>
					{!!session && !isOwnProfile && (
						<div className="mt-3">
							<ReportButton targetType="user" targetId={profile.user_id} />
						</div>
					)}
				</div>

				{/* Reviews */}
				{reviews.length > 0 && (
					<div data-testid="reviews-section" className="mb-8">
						<h2 className="mb-4 text-sm font-semibold text-foreground">{t("reviews.heading")}</h2>
						<div className="space-y-3">
							{reviews.map((review) => (
								<div key={review.id} className="rounded-l border border-border bg-card p-4">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">{review.reviewer_display_name}</span>
										<span className="text-xs text-muted">
											{formatDate(new Date(review.created_at), {
												year: "numeric",
												month: "short",
												day: "numeric",
											})}
										</span>
									</div>
									<div className="mt-1 text-yellow-500">
										{"★".repeat(review.rating)}
										<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span>
									</div>
									{!!review.comment && (
										<p className="mt-2 text-sm text-foreground">{review.comment}</p>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				{/* Listings */}
				<h2 className="mb-4 text-sm font-semibold text-foreground">
					{t("publicProfile.listingsHeading", { count: listings.length })}
				</h2>
				{listings.length === 0 ? (
					<p className="text-sm text-muted">{t("publicProfile.noListings")}</p>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{listings.map((listing) => (
							<ListingCard
								key={listing.id}
								listing={listing}
								images={imagesByListing.get(listing.id) ?? []}
								makeSlug={listing.makeSlug}
								modelName={listing.modelName}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
