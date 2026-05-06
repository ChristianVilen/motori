// src/routes/ilmoitukset/$listingId_.$slug.tsx
// $slug is decorative — only $listingId (the short_id) is used for DB lookup.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { BookingRequestForm } from "~/components/listings/booking-request-form";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { Button } from "~/components/ui/button";
import { MobileFullscreenModal } from "~/components/ui/mobile-fullscreen-modal";
import { createBookingRequest } from "~/lib/bookings.server";
import {
	LICENSE_CLASSES,
	LISTING_STATUSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SITE_NAME,
	SITE_URL,
} from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getListingAvailability, getListingForDisplay, recordView } from "~/lib/listings-queries";
import { protectedMutation } from "~/lib/middleware";
import { computeReviewSummary, getReviewsForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import { bookingRequestSchema } from "~/lib/validators";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const result = await getListingForDisplay(shortId);
		if (!result) {
			return null;
		}

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordView(shortId, session?.user.id, ip);

		const ownerReviews = await getReviewsForUser(result.listing.owner_id);
		const ownerReviewSummary = computeReviewSummary(ownerReviews);

		return { ...result, ownerReviewSummary };
	});

export const submitBookingRequest = createServerFn({ method: "POST" })
	.middleware(protectedMutation("submit-booking", 5, 300))
	.inputValidator((data: unknown) => bookingRequestSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		return createBookingRequest({
			listingId: data.listing_id,
			startDate: data.start_date,
			endDate: data.end_date,
			message: data.message,
			userId: session.user.id,
			userEmail: session.user.email,
		});
	});

export const Route = createFileRoute("/ilmoitukset/$listingId_/$slug")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		const availability = await getListingAvailability({ data: result.listing.id });
		return { ...result, session, availability };
	},
	head: ({ loaderData }) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const make = loaderData?.makeName ?? "";
		const model = loaderData?.modelName ?? "";
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Vuokraa ${make} ${model} (${l.year}) — ${l.city}. Alkaen ${centsToEuros(l.price_per_day).toFixed(0)} €/pv.`;
		const slug = computeListingSlug(
			loaderData?.makeSlug ?? null,
			loaderData?.modelName ?? null,
			l.city,
		);
		const url = `${SITE_URL}/ilmoitukset/${l.short_id}/${slug}`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:title", content: title },
				{ property: "og:description", content: desc },
				{ property: "og:url", content: url },
			],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: ListingDetailPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div
				data-testid="listing-not-found"
				className="flex min-h-screen flex-col items-center justify-center gap-4"
			>
				<p className="text-muted">{t("detail.notFound")}</p>
				<Link to="/" className="text-sm text-accent underline">
					{t("detail.notFoundBack")}
				</Link>
			</div>
		);
	},
});

function ListingSpecs({
	listing,
	makeName,
	modelName,
}: {
	listing: Listing;
	makeName: string | null;
	modelName: string | null;
}) {
	const { t } = useTranslation("listings");

	return (
		<div className="rounded-l border border-border bg-card p-5">
			<h2 className="mb-3 text-sm font-semibold text-foreground">{t("detail.specs.heading")}</h2>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				{!!makeName && (
					<div>
						<dt className="text-muted">{t("detail.specs.brand")}</dt>
						<dd className="font-medium text-foreground">{makeName}</dd>
					</div>
				)}
				{!!modelName && (
					<div>
						<dt className="text-muted">{t("detail.specs.model")}</dt>
						<dd className="font-medium text-foreground">{modelName}</dd>
					</div>
				)}
				<div>
					<dt className="text-muted">{t("detail.specs.year")}</dt>
					<dd className="font-medium text-foreground">{listing.year}</dd>
				</div>
				{!!listing.engine_cc && (
					<div>
						<dt className="text-muted">{t("detail.specs.engine")}</dt>
						<dd className="font-medium text-foreground">
							{listing.engine_cc} {t("detail.specs.engineUnit")}
						</dd>
					</div>
				)}
				{!!listing.mileage_limit && (
					<div>
						<dt className="text-muted">{t("detail.specs.mileageLimit")}</dt>
						<dd className="font-medium text-foreground">
							{listing.mileage_limit} {t("detail.specs.mileageLimitUnit")}
						</dd>
					</div>
				)}
			</dl>
		</div>
	);
}

interface PricingCardProps {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	listing: Listing;
	isOwner: boolean;
}

function PricingCard({
	pricePerDayCents,
	pricePerWeekCents,
	pricePerWeekendCents,
	listing,
	isOwner,
}: PricingCardProps) {
	const { t } = useTranslation("listings");

	return (
		<div className="rounded-l border border-border bg-card p-5 shadow-sm">
			<div data-testid="price-info" className="mb-4">
				<span data-testid="price-per-day" className="text-3xl font-bold text-accent">
					{formatEur(pricePerDayCents)}
				</span>
				<span className="ml-1 text-sm text-muted">{t("detail.pricing.perDay")}</span>
				{!!pricePerWeekCents && (
					<div data-testid="price-per-week" className="mt-1 text-sm text-muted">
						{t("detail.pricing.perWeek", { price: formatEur(pricePerWeekCents) })}
					</div>
				)}
				{!!pricePerWeekendCents && (
					<div data-testid="price-per-weekend" className="mt-1 text-sm text-muted">
						{t("detail.pricing.perWeekend", { price: formatEur(pricePerWeekendCents) })}
					</div>
				)}
				{!!listing.price_description && (
					<div className="mt-1 text-xs text-muted">{listing.price_description}</div>
				)}
			</div>
			{!!isOwner && (
				<div className="mt-3 flex gap-2">
					<Link
						data-testid="listing-edit-link"
						to="/ilmoitukset/$listingId/muokkaa"
						params={{ listingId: listing.short_id }}
						className="flex-1"
					>
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.edit")}
						</Button>
					</Link>
					<Link data-testid="listing-owner-profile-link" to="/omat" className="flex-1">
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.myListings")}
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}

function MobileBottomBar({
	pricePerDayCents,
	pricePerWeekCents,
	pricePerWeekendCents,
	isOwner,
	isActive,
	isLoggedIn,
	redirectPath,
	onBookClick,
	t,
}: {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	isOwner: boolean;
	isActive: boolean;
	isLoggedIn: boolean;
	redirectPath: string;
	onBookClick: () => void;
	t: (key: string, opts?: Record<string, unknown>) => string;
}) {
	return (
		<div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden">
			<div className="flex items-center justify-between gap-4">
				<div>
					<div>
						<span className="text-lg font-bold text-accent">{formatEur(pricePerDayCents)}</span>
						<span className="ml-1 text-xs text-muted">{t("detail.pricing.perDay")}</span>
					</div>
					{(pricePerWeekCents ?? pricePerWeekendCents) ? (
						<div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
							{pricePerWeekCents ? (
								<span>{t("detail.pricing.perWeek", { price: formatEur(pricePerWeekCents) })}</span>
							) : null}
							{pricePerWeekendCents ? (
								<span>
									{t("detail.pricing.perWeekend", { price: formatEur(pricePerWeekendCents) })}
								</span>
							) : null}
						</div>
					) : null}
				</div>
				{!isOwner && isActive && !isLoggedIn && (
					<Link
						to="/kirjaudu"
						search={{ redirect: redirectPath }}
						className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
					>
						{t("booking.loginRequired")}
					</Link>
				)}
				{!isOwner && isActive && isLoggedIn && (
					<button
						type="button"
						data-testid="mobile-book-button"
						onClick={onBookClick}
						className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
					>
						{t("detail.bookingCta")}
					</button>
				)}
			</div>
		</div>
	);
}

function BookingSidebar({
	listing,
	availability,
	session,
	images,
}: {
	listing: Listing;
	availability: {
		availability_default: "open" | "closed";
		exception_dates: string[];
		booked_dates: string[];
	};
	session: { user: { id: string } } | null;
	images: { thumbnail_url?: string | null; url: string }[];
}) {
	const isOwner = session?.user.id === listing.owner_id;

	if (isOwner) {
		return (
			<div id="pricing" className="space-y-4 lg:self-start">
				<PricingCard
					pricePerDayCents={listing.price_per_day}
					pricePerWeekCents={listing.price_per_week ?? null}
					pricePerWeekendCents={listing.price_per_weekend ?? null}
					listing={listing}
					isOwner={true}
				/>
			</div>
		);
	}

	if (listing.status !== "active") {
		return null;
	}

	const bookingFormProps = {
		listingId: listing.id,
		availabilityDefault: availability.availability_default,
		exceptionDates: availability.exception_dates,
		bookedDates: availability.booked_dates,
		isLoggedIn: !!session,
		pricePerDayCents: listing.price_per_day,
		pricePerWeekCents: listing.price_per_week ?? null,
		pricePerWeekendCents: listing.price_per_weekend ?? null,
		heroImageUrl: images[0]?.thumbnail_url ?? images[0]?.url ?? null,
		onSubmit: async (input: { start_date: string; end_date: string; message: string }) => {
			await submitBookingRequest({
				data: { listing_id: listing.id, ...input },
			});
		},
	};

	return (
		<div id="pricing" className="space-y-4 lg:self-start">
			<div className="hidden lg:block" data-testid="booking-section">
				<BookingRequestForm {...bookingFormProps} />
			</div>
			{!!session && (
				<div className="text-center">
					<ReportButton targetType="listing" targetId={listing.id} />
				</div>
			)}
		</div>
	);
}

function ListingDetailPage() {
	const { t } = useTranslation("listings");
	const { t: tProfile } = useTranslation("profile");
	const {
		listing,
		images,
		session,
		makeName,
		makeSlug,
		modelName,
		availability,
		ownerReviewSummary,
	} = Route.useLoaderData();

	const [bookingModalOpen, setBookingModalOpen] = useState(false);

	const isOwner = session?.user.id === listing.owner_id;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
	const statusLabel = LISTING_STATUSES[listing.status];
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	const redirectPath = `/ilmoitukset/${listing.short_id}/${slug}`;

	return (
		<div data-testid="listing-detail" className="min-h-screen bg-background pb-20 md:pb-0">
			<div className="mx-auto max-w-4xl px-4 py-4 md:py-8">
				{/* Back */}
				<Link
					data-testid="listing-detail-back"
					to="/ilmoitukset"
					className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("detail.back")}
				</Link>

				<div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8">
					{/* Left column */}
					<div className="space-y-4">
						<ListingGallery images={images} title={listing.title} />

						{/* Title + badges */}
						<div>
							<div className="flex items-start justify-between gap-3">
								<h1
									data-testid="listing-detail-title"
									className="text-xl font-bold text-primary md:text-2xl"
								>
									{listing.title}
								</h1>
								<div className="flex shrink-0 gap-2">
									{!!isOwner && (
										<span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
											{t("card.ownBadge")}
										</span>
									)}
									{listing.status !== "active" && (
										<span
											data-testid="listing-status-badge"
											className="rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning"
										>
											{statusLabel}
										</span>
									)}
								</div>
							</div>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								<span
									data-testid="listing-type"
									className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
								>
									<Tag className="h-3 w-3" />
									{typeLabel}
								</span>
								<span
									data-testid="location-info"
									className="flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted"
								>
									<MapPin className="h-3 w-3" />
									{listing.city}, {regionLabel}
								</span>
								{!!licenseLabel && (
									<span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
										{t("detail.licenseBadge", { license: licenseLabel })}
									</span>
								)}
								{ownerReviewSummary.averageRating !== null && (
									<Link
										to="/profiili/$userId"
										params={{ userId: listing.owner_id }}
										className="rounded-full bg-muted-light px-2.5 py-0.5 text-xs text-muted hover:text-accent"
									>
										{ownerReviewSummary.reviewCount === 1
											? tProfile("reviews.summaryOne", {
													rating: ownerReviewSummary.averageRating,
												})
											: tProfile("reviews.summary", {
													rating: ownerReviewSummary.averageRating,
													count: ownerReviewSummary.reviewCount,
												})}
									</Link>
								)}
							</div>
						</div>

						<ListingSpecs listing={listing} makeName={makeName} modelName={modelName} />

						{/* Description */}
						<div>
							<h2 className="mb-1.5 text-sm font-semibold text-foreground">
								{t("detail.description")}
							</h2>
							<p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
								{listing.description}
							</p>
						</div>
					</div>

					{/* Right column — booking */}
					<BookingSidebar
						listing={listing}
						availability={availability}
						session={session}
						images={images}
					/>
				</div>
			</div>

			<MobileBottomBar
				pricePerDayCents={listing.price_per_day}
				pricePerWeekCents={listing.price_per_week ?? null}
				pricePerWeekendCents={listing.price_per_weekend ?? null}
				isOwner={!!isOwner}
				isActive={listing.status === "active"}
				isLoggedIn={!!session}
				redirectPath={redirectPath}
				onBookClick={() => setBookingModalOpen(true)}
				t={t}
			/>

			{/* Mobile booking modal */}
			<MobileFullscreenModal
				open={bookingModalOpen}
				onClose={() => setBookingModalOpen(false)}
				title={t("booking.calendarTitle")}
			>
				<div data-testid="booking-section">
					<BookingRequestForm
						listingId={listing.id}
						availabilityDefault={availability.availability_default}
						exceptionDates={availability.exception_dates}
						bookedDates={availability.booked_dates}
						isLoggedIn={!!session}
						pricePerDayCents={listing.price_per_day}
						pricePerWeekCents={listing.price_per_week ?? null}
						pricePerWeekendCents={listing.price_per_weekend ?? null}
						heroImageUrl={images[0]?.thumbnail_url ?? images[0]?.url ?? null}
						onSubmit={async (input) => {
							await submitBookingRequest({
								data: { listing_id: listing.id, ...input },
							});
						}}
					/>
				</div>
			</MobileFullscreenModal>
		</div>
	);
}
