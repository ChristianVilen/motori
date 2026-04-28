// src/routes/ilmoitukset/$listingId.tsx
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { ArrowLeft, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ReportButton } from "~/components/report-button";
import { Button } from "~/components/ui/button";
import {
	LICENSE_CLASSES,
	LISTING_STATUSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SITE_NAME,
	SITE_URL,
} from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

// In-memory dedup for view count increments (per-process, 60s TTL, 10k cap)
const VIEW_DEDUP_MAX = 10_000;
const viewedRecently = new Set<string>();

function maybeIncrementViewCount(listingId: string, userId: string | undefined) {
	const request = getRequest();
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
	// When the set is full, dedup stops and every view is counted (fail-open).
	const dedupKey = userId ? `view:${listingId}:${userId}` : `view:${listingId}:${ip}`;
	if (viewedRecently.size < VIEW_DEDUP_MAX && viewedRecently.has(dedupKey)) {
		return;
	}
	if (viewedRecently.size < VIEW_DEDUP_MAX) {
		viewedRecently.add(dedupKey);
		setTimeout(() => viewedRecently.delete(dedupKey), 60_000);
	}
	// updated_at intentionally omitted — view bumps should not surface listings
	// as "recently updated" in sorting or the sitemap lastmod.
	db.updateTable("listing")
		.set({ view_count: sql`view_count + 1` })
		.where("id", "=", listingId)
		.execute()
		.catch(() => {});
}

const getListing = createServerFn({ method: "GET" })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const session = await getSession();

		const row = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.selectAll("listing")
			.select(["motorcycle_make.name as makeName", "motorcycle_model.name as modelName"])
			.where("listing.id", "=", id)
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const { makeName, modelName, ...listing } = row;

		maybeIncrementViewCount(id, session?.user.id);

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", id)
			.orderBy("order", "asc")
			.execute();

		const ownerRow = await db
			.selectFrom("profile")
			.select(["display_name", "city", "phone", "show_phone"])
			.where("user_id", "=", listing.owner_id)
			.executeTakeFirst();

		// Gate contact details: only signed-in users get phone (and only if owner opted in),
		// and the email address is exposed only to the owner themselves.
		const isOwner = session?.user.id === listing.owner_id;
		const isSignedIn = !!session;
		const phone = ownerRow && isSignedIn && ownerRow.show_phone ? ownerRow.phone : null;
		const owner = ownerRow
			? { display_name: ownerRow.display_name, city: ownerRow.city, phone }
			: null;

		let ownerEmail: string | null = null;
		if (isOwner) {
			const ownerUser = await db
				.selectFrom("user")
				.select(["email"])
				.where("id", "=", listing.owner_id)
				.executeTakeFirst();
			ownerEmail = ownerUser?.email ?? null;
		}

		return {
			listing,
			images,
			owner,
			ownerEmail,
			makeName: makeName ?? null,
			modelName: modelName ?? null,
		};
	});

export const Route = createFileRoute("/ilmoitukset/$listingId")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		return { ...result, session };
	},
	head: ({ loaderData }) => {
		const l = loaderData?.listing;
		if (!l) {
			return {};
		}
		const make = loaderData?.makeName ?? "";
		const model = loaderData?.modelName ?? "";
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Vuokraa ${make} ${model} (${l.year}) — ${l.city}. Alkaen ${(l.price_per_day / 100).toFixed(0)} €/pv.`;
		const url = `${SITE_URL}/ilmoitukset/${l.id}`;
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
		<div className="rounded-xl border border-border bg-card p-5">
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
	listing: Listing;
	owner: { display_name: string | null; city: string | null; phone: string | null } | null;
	ownerEmail: string | null;
	isOwner: boolean;
	isSignedIn: boolean;
}

function PricingCard({
	pricePerDayCents,
	pricePerWeekCents,
	listing,
	owner,
	ownerEmail,
	isOwner,
	isSignedIn,
}: PricingCardProps) {
	const { t } = useTranslation("listings");
	const [contactVisible, setContactVisible] = useState(false);

	return (
		<div className="rounded-xl border border-border bg-card p-5 shadow-sm">
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
				{!!listing.price_description && (
					<div className="mt-1 text-xs text-muted">{listing.price_description}</div>
				)}
			</div>

			{/* Contact reveal — gated behind sign-in to deter scrapers */}
			{!isSignedIn ? (
				<Link
					data-testid="owner-contact-login"
					to="/kirjaudu"
					search={{ redirect: `/ilmoitukset/${listing.id}` }}
					className="block w-full rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-white hover:bg-accent-hover"
				>
					{t("detail.contact.loginPrompt")}
				</Link>
			) : !contactVisible ? (
				<Button
					data-testid="owner-contact-reveal"
					onClick={() => setContactVisible(true)}
					className="w-full bg-accent text-white hover:bg-accent-hover"
				>
					{t("detail.contact.reveal")}
				</Button>
			) : (
				<div
					data-testid="owner-contact"
					className="space-y-2 rounded-lg bg-muted-light p-3 text-sm"
				>
					<Link
						data-testid="owner-name"
						to="/profiili/$userId"
						params={{ userId: listing.owner_id }}
						className="block font-medium text-foreground hover:text-accent"
					>
						{owner?.display_name ?? t("detail.contact.fallbackName")}
					</Link>
					{!!owner?.phone && (
						<a
							data-testid="owner-phone"
							href={`tel:${owner.phone}`}
							className="block text-accent hover:underline"
						>
							{owner.phone}
						</a>
					)}
					{!!ownerEmail && (
						<a
							data-testid="owner-email"
							href={`mailto:${ownerEmail}`}
							className="block text-accent hover:underline"
						>
							{ownerEmail}
						</a>
					)}
					{!!owner?.city && (
						<p data-testid="owner-city" className="text-muted">
							{owner.city}
						</p>
					)}
				</div>
			)}

			{/* Owner actions */}
			{!!isOwner && (
				<div className="mt-3 flex gap-2">
					<Link
						data-testid="listing-edit-link"
						to="/ilmoitukset/$listingId/muokkaa"
						params={{ listingId: listing.id }}
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

function ListingDetailPage() {
	const { t } = useTranslation("listings");
	const { listing, images, owner, ownerEmail, session, makeName, modelName } =
		Route.useLoaderData();

	const isOwner = session?.user.id === listing.owner_id;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
	const statusLabel = LISTING_STATUSES[listing.status];

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

					{/* Right column — sticky sidebar (desktop only) */}
					<div className="hidden space-y-4 lg:block lg:sticky lg:top-8 lg:self-start">
						<PricingCard
							pricePerDayCents={listing.price_per_day}
							pricePerWeekCents={listing.price_per_week ?? null}
							listing={listing}
							owner={owner}
							ownerEmail={ownerEmail}
							isOwner={!!isOwner}
							isSignedIn={!!session}
						/>

						{/* Listing meta */}
						<p className="text-center text-xs text-muted">
							{t("detail.viewCount", { n: listing.view_count })}
						</p>
						{!!session && !isOwner && (
							<div className="text-center">
								<ReportButton targetType="listing" targetId={listing.id} />
							</div>
						)}
					</div>

					{/* Mobile pricing — inline card below content */}
					<div id="pricing" className="space-y-4 lg:hidden">
						<PricingCard
							pricePerDayCents={listing.price_per_day}
							pricePerWeekCents={listing.price_per_week ?? null}
							listing={listing}
							owner={owner}
							ownerEmail={ownerEmail}
							isOwner={!!isOwner}
							isSignedIn={!!session}
						/>
						<p className="text-center text-xs text-muted">
							{t("detail.viewCount", { n: listing.view_count })}
						</p>
						{!!session && !isOwner && (
							<div className="text-center">
								<ReportButton targetType="listing" targetId={listing.id} />
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Sticky bottom bar on mobile — quick price + CTA */}
			<div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md lg:hidden">
				<div className="flex items-center justify-between gap-4">
					<div>
						<span className="text-lg font-bold text-accent">
							{formatEur(listing.price_per_day)}
						</span>
						<span className="ml-1 text-xs text-muted">{t("detail.pricing.perDay")}</span>
					</div>
					{!session ? (
						<Link
							to="/kirjaudu"
							search={{ redirect: `/ilmoitukset/${listing.id}` }}
							className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
						>
							{t("detail.contact.loginPrompt")}
						</Link>
					) : (
						<Link
							to=""
							hash="pricing"
							className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
						>
							{t("detail.contact.reveal")}
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
