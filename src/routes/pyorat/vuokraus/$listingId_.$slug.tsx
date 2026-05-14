// src/routes/pyorat/vuokraus/$listingId_.$slug.tsx
// $slug is decorative — only $listingId (the short_id) is used for DB lookup.
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useState } from "react";
import { z } from "zod";
import { BookingRequestForm } from "~/components/listings/booking-request-form";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { ReportButton } from "~/components/report-button";
import { Button } from "~/components/ui/button";
import { MobileFullscreenModal } from "~/components/ui/mobile-fullscreen-modal";
import { createBookingRequest } from "~/lib/bookings.server";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getListingAvailability, getListingForDisplay, recordView } from "~/lib/listings-queries";
import { startConversation } from "~/lib/messages";
import { protectedMutation } from "~/lib/middleware";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import { bookingRequestSchema } from "~/lib/validators";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: unknown) => z.string().min(1).max(20).parse(shortId))
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const result = await getListingForDisplay(shortId);
		if (!result || result.listing.category !== "rental") {
			return null;
		}

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordView(shortId, session?.user.id, ip);

		const ownerReviewSummary = await getReviewSummaryForUser(result.listing.owner_id);

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

export const Route = createFileRoute("/pyorat/vuokraus/$listingId_/$slug")({
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
		const desc = `Vuokraa ${make} ${model} (${l.year}) — ${l.city}. Alkaen ${centsToEuros(loaderData?.rental?.price_per_day ?? 0).toFixed(0)} €/pv.`;
		const slug = computeListingSlug(
			loaderData?.makeSlug ?? null,
			loaderData?.modelName ?? null,
			l.city,
		);
		const url = `${SITE_URL}/pyorat/vuokraus/${l.short_id}/${slug}`;
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

interface PricingCardProps {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	priceDescription: string | null;
	listing: Listing;
	isOwner: boolean;
}

function PricingCard({
	pricePerDayCents,
	pricePerWeekCents,
	pricePerWeekendCents,
	priceDescription,
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
				{!!priceDescription && <div className="mt-1 text-xs text-muted">{priceDescription}</div>}
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
		<div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md md:bottom-0 lg:hidden">
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
	rental,
	availability,
	session,
	images,
}: {
	listing: Listing;
	rental: {
		price_per_day: number;
		price_per_week: number | null;
		price_per_weekend: number | null;
		price_description: string | null;
		mileage_limit: number | null;
	} | null;
	availability: {
		availability_default: "open" | "closed";
		exception_dates: string[];
		booked_dates: string[];
	};
	session: { user: { id: string } } | null;
	images: { thumbnail_url?: string | null; url: string }[];
}) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const isOwner = session?.user.id === listing.owner_id;

	if (isOwner) {
		return (
			<div id="pricing" className="space-y-4 lg:self-start">
				<PricingCard
					pricePerDayCents={rental?.price_per_day ?? 0}
					pricePerWeekCents={rental?.price_per_week ?? null}
					pricePerWeekendCents={rental?.price_per_weekend ?? null}
					priceDescription={rental?.price_description ?? null}
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
		pricePerDayCents: rental?.price_per_day ?? 0,
		pricePerWeekCents: rental?.price_per_week ?? null,
		pricePerWeekendCents: rental?.price_per_weekend ?? null,
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
				<button
					type="button"
					onClick={async () => {
						const { conversationId } = await startConversation({
							data: { listingId: listing.id },
						});
						navigate({ to: "/viestit/$conversationId", params: { conversationId } });
					}}
					className="mt-2 block w-full rounded-lg border border-accent px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-accent/5"
				>
					{t("detail.messageSeller", "Lähetä viesti")}
				</button>
			)}
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
	const {
		listing,
		rental,
		images,
		session,
		makeName,
		makeSlug,
		modelName,
		availability,
		ownerReviewSummary,
		ownerContact,
	} = Route.useLoaderData();

	const [bookingModalOpen, setBookingModalOpen] = useState(false);

	const isOwner = session?.user.id === listing.owner_id;
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	const redirectPath = `/pyorat/vuokraus/${listing.short_id}/${slug}`;

	const sidebar = (
		<BookingSidebar
			listing={listing}
			rental={rental}
			availability={availability}
			session={session}
			images={images}
		/>
	);

	const mobileBar = (
		<>
			<MobileBottomBar
				pricePerDayCents={rental?.price_per_day ?? 0}
				pricePerWeekCents={rental?.price_per_week ?? null}
				pricePerWeekendCents={rental?.price_per_weekend ?? null}
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
						pricePerDayCents={rental?.price_per_day ?? 0}
						pricePerWeekCents={rental?.price_per_week ?? null}
						pricePerWeekendCents={rental?.price_per_weekend ?? null}
						heroImageUrl={images[0]?.thumbnail_url ?? images[0]?.url ?? null}
						onSubmit={async (input) => {
							await submitBookingRequest({
								data: { listing_id: listing.id, ...input },
							});
						}}
					/>
				</div>
			</MobileFullscreenModal>
		</>
	);

	return (
		<ListingDetailShell
			data={{
				listing,
				rental,
				sale: null,
				gear: null,
				part: null,
				images,
				makeName,
				makeSlug,
				modelName,
				ownerReviewSummary,
				ownerContact,
			}}
			session={session}
			backTo="/pyorat/vuokraus"
			backLabel={t("detail.back")}
			sidebar={sidebar}
			mobileBar={mobileBar}
		/>
	);
}
