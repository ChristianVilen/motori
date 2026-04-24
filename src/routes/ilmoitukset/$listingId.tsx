// src/routes/ilmoitukset/$listingId.tsx
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { ArrowLeft, Calendar, MapPin, Tag } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { LICENSE_CLASSES, LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { db } from "~/lib/db/index";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const session = await getSession();

		const listing = await db
			.selectFrom("listing")
			.selectAll()
			.where("listing.id", "=", id)
			.where("listing.status", "!=", "removed")
			.executeTakeFirst();

		if (!listing) {
			return null;
		}

		// Fire-and-forget — sql expression avoids RMW race on concurrent views.
		db.updateTable("listing")
			.set({ view_count: sql`view_count + 1`, updated_at: new Date() })
			.where("id", "=", id)
			.execute()
			.catch(() => {});

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

		return { listing, images, owner, ownerEmail };
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
		if (!l) return {};
		const title = `${l.title} — Vuokramoto`;
		const desc = `Vuokraa ${l.brand} ${l.model} (${l.year}) — ${l.city}. Alkaen ${(l.price_per_day / 100).toFixed(0)} €/pv.`;
		return {
			meta: [
				{ title },
				{ name: "description", content: desc },
				{ property: "og:title", content: title },
				{ property: "og:description", content: desc },
			],
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

function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
	const [activeImage, setActiveImage] = useState(0);

	if (images.length === 0) {
		return (
			<div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted-light">
				<svg
					className="h-16 w-16 text-border"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1}
						d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
					/>
				</svg>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted-light">
				<img src={images[activeImage]?.url} alt={title} className="h-full w-full object-cover" />
			</div>
			{images.length > 1 && (
				<div className="flex gap-2 overflow-x-auto pb-1">
					{images.map((img, i) => (
						<button
							key={img.id}
							type="button"
							onClick={() => setActiveImage(i)}
							className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
								i === activeImage ? "border-accent" : "border-transparent"
							}`}
						>
							<img src={img.url} alt="" className="h-full w-full object-cover" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function ListingSpecs({ listing }: { listing: Listing }) {
	const { t } = useTranslation("listings");

	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<h2 className="mb-3 text-sm font-semibold text-foreground">{t("detail.specs.heading")}</h2>
			<dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
				<div>
					<dt className="text-muted">{t("detail.specs.brand")}</dt>
					<dd className="font-medium text-foreground">{listing.brand}</dd>
				</div>
				<div>
					<dt className="text-muted">{t("detail.specs.model")}</dt>
					<dd className="font-medium text-foreground">{listing.model}</dd>
				</div>
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
				{!!listing.available_from && (
					<div>
						<dt className="flex items-center gap-1 text-muted">
							<Calendar className="h-3 w-3" />
							{t("detail.specs.available")}
						</dt>
						<dd className="font-medium text-foreground">
							{listing.available_from}
							{listing.available_to ? ` – ${listing.available_to}` : ""}
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
	depositCents: number | null;
	listing: Listing;
	owner: { display_name: string | null; city: string | null; phone: string | null } | null;
	ownerEmail: string | null;
	isOwner: boolean;
	isSignedIn: boolean;
}

function PricingCard({
	pricePerDayCents,
	pricePerWeekCents,
	depositCents,
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
				{!!depositCents && (
					<div data-testid="price-deposit" className="mt-1 text-sm text-muted">
						{t("detail.pricing.deposit", { price: formatEur(depositCents) })}
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
	const { listing, images, owner, ownerEmail, session } = Route.useLoaderData();

	const isOwner = session?.user.id === listing.owner_id;
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const licenseLabel =
		LICENSE_CLASSES.find((l) => l.value === listing.required_license)?.label ?? null;
	const statusLabel = LISTING_STATUSES[listing.status];

	return (
		<div data-testid="listing-detail" className="min-h-screen bg-background">
			<div className="mx-auto max-w-4xl px-4 py-8">
				{/* Back */}
				<Link
					data-testid="listing-detail-back"
					to="/"
					className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("detail.back")}
				</Link>

				<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
					{/* Left column */}
					<div className="space-y-6">
						<ListingGallery images={images} title={listing.title} />

						{/* Title + badges */}
						<div>
							<div className="flex items-start justify-between gap-3">
								<h1 data-testid="listing-detail-title" className="text-2xl font-bold text-primary">
									{listing.title}
								</h1>
								{listing.status !== "active" && (
									<span
										data-testid="listing-status-badge"
										className="shrink-0 rounded bg-warning/20 px-2 py-1 text-xs font-medium text-warning"
									>
										{statusLabel}
									</span>
								)}
							</div>
							<div className="mt-2 flex flex-wrap gap-2">
								<span
									data-testid="listing-type"
									className="flex items-center gap-1 rounded-full bg-muted-light px-3 py-1 text-xs text-muted"
								>
									<Tag className="h-3 w-3" />
									{typeLabel}
								</span>
								<span
									data-testid="location-info"
									className="flex items-center gap-1 rounded-full bg-muted-light px-3 py-1 text-xs text-muted"
								>
									<MapPin className="h-3 w-3" />
									{listing.city}, {regionLabel}
								</span>
								{!!licenseLabel && (
									<span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
										{t("detail.licenseBadge", { license: licenseLabel })}
									</span>
								)}
							</div>
						</div>

						<ListingSpecs listing={listing} />

						{/* Description */}
						<div>
							<h2 className="mb-2 text-sm font-semibold text-foreground">
								{t("detail.description")}
							</h2>
							<p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
								{listing.description}
							</p>
						</div>
					</div>

					{/* Right column — sticky sidebar */}
					<div className="space-y-4 lg:sticky lg:top-8 lg:self-start">
						<PricingCard
							pricePerDayCents={listing.price_per_day}
							pricePerWeekCents={listing.price_per_week ?? null}
							depositCents={listing.deposit_amount ?? null}
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
					</div>
				</div>
			</div>
		</div>
	);
}
