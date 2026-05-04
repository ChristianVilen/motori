// src/routes/ilmoitukset/$listingId_.$slug.tsx
// $slug is decorative — only $listingId (the short_id) is used for DB lookup.
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { BookingRequestForm } from "~/components/listings/booking-request-form";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { Button } from "~/components/ui/button";
import { MobileFullscreenModal } from "~/components/ui/mobile-fullscreen-modal";
import { sendBookingRequestEmail } from "~/lib/booking-emails";
import { generateBookingShortId } from "~/lib/bookings";
import {
	LICENSE_CLASSES,
	LISTING_STATUSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SITE_NAME,
	SITE_URL,
} from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { centsToEuros } from "~/lib/currency";
import { db } from "~/lib/db/index";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getListingAvailability, getListingForDisplay, recordView } from "~/lib/listings";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
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

		return result;
	});

export const submitBookingRequest = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 300, "submit-booking"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: unknown) => bookingRequestSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const listing = await db
			.selectFrom("listing")
			.innerJoin("user", "user.id", "listing.owner_id")
			.innerJoin("profile", "profile.user_id", "listing.owner_id")
			.select([
				"listing.id",
				"listing.title",
				"listing.owner_id",
				"listing.status",
				"user.email as owner_email",
				"profile.display_name as owner_display_name",
				"profile.phone as owner_phone",
				"profile.show_phone as owner_show_phone",
				"profile.language as owner_language",
			])
			.where("listing.id", "=", data.listing_id)
			.executeTakeFirst();

		if (!listing || listing.status !== "active") {
			throw new Error("Ilmoitus ei ole saatavilla");
		}

		if (listing.owner_id === session.user.id) {
			throw new Error("Et voi varata omaa ilmoitustasi");
		}

		const renterProfile = await db
			.selectFrom("profile")
			.select(["display_name", "phone", "show_phone", "language"])
			.where("user_id", "=", session.user.id)
			.executeTakeFirst();

		if (!renterProfile) {
			throw new Error("Profiili puuttuu");
		}

		const collisions = await db
			.selectFrom("booking")
			.select([
				sql<string>`to_char(start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(end_date, 'YYYY-MM-DD')`.as("end_date"),
			])
			.where("listing_id", "=", listing.id)
			.where("status", "=", "confirmed")
			.where("start_date", "<=", data.end_date)
			.where("end_date", ">=", data.start_date)
			.execute();

		if (collisions.length > 0) {
			throw new Error("Päivät on jo varattu");
		}

		const shortId = generateBookingShortId();
		const inserted = await db
			.insertInto("booking")
			.values({
				short_id: shortId,
				listing_id: listing.id,
				renter_user_id: session.user.id,
				start_date: data.start_date,
				end_date: data.end_date,
				message: data.message,
			})
			.returning(["id", "short_id"])
			.executeTakeFirstOrThrow();

		log.event(EVENTS.booking.requested, {
			bookingId: inserted.id,
			listingId: listing.id,
			renterId: session.user.id,
		});

		void sendBookingRequestEmail({
			booking: {
				short_id: inserted.short_id,
				listing_title: listing.title,
				start_date: data.start_date,
				end_date: data.end_date,
			},
			owner: {
				display_name: listing.owner_display_name,
				email: listing.owner_email,
				phone: listing.owner_show_phone ? listing.owner_phone : null,
				language: listing.owner_language,
			},
			renter: {
				display_name: renterProfile.display_name,
				email: session.user.email,
				phone: renterProfile.show_phone ? renterProfile.phone : null,
				language: renterProfile.language,
			},
			message: data.message,
		});

		return { short_id: inserted.short_id };
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
	const { listing, images, session, makeName, makeSlug, modelName, availability } =
		Route.useLoaderData();

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
			</MobileFullscreenModal>
		</div>
	);
}
