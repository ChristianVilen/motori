// src/routes/ilmoitukset/$listingId.tsx
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "kysely";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Tag, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import type { Listing, ListingImage } from "~/lib/db/schema";
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

function ListingGallery({ images, title }: { images: ListingImage[]; title: string }) {
	const [activeImage, setActiveImage] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	const prev = useCallback(() => {
		setActiveImage((i) => (i > 0 ? i - 1 : images.length - 1));
	}, [images.length]);
	const next = useCallback(() => {
		setActiveImage((i) => (i < images.length - 1 ? i + 1 : 0));
	}, [images.length]);

	useEffect(() => {
		if (!lightboxOpen) {
			return;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setLightboxOpen(false);
			}
			if (e.key === "ArrowLeft") {
				prev();
			}
			if (e.key === "ArrowRight") {
				next();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [lightboxOpen, prev, next]);

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

	const arrowBtn =
		"absolute top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70";

	return (
		<>
			<div className="space-y-2">
				{/* Main image */}
				<div className="group relative aspect-[16/10] overflow-hidden rounded-xl bg-black">
					<button
						type="button"
						onClick={() => setLightboxOpen(true)}
						className="h-full w-full cursor-zoom-in"
						aria-label="Avaa kuva isompana"
					>
						<img
							src={images[activeImage]?.url}
							alt={title}
							className="h-full w-full object-contain"
						/>
					</button>
					{images.length > 1 && (
						<>
							<button
								type="button"
								onClick={prev}
								className={`${arrowBtn} left-2`}
								aria-label="Edellinen kuva"
							>
								<ChevronLeft className="h-5 w-5" />
							</button>
							<button
								type="button"
								onClick={next}
								className={`${arrowBtn} right-2`}
								aria-label="Seuraava kuva"
							>
								<ChevronRight className="h-5 w-5" />
							</button>
							<span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
								{activeImage + 1} / {images.length}
							</span>
						</>
					)}
				</div>
				{/* Thumbnails */}
				{images.length > 1 && (
					<div className="flex gap-2 overflow-x-auto pb-1">
						{images.map((img, i) => (
							<button
								key={img.id}
								type="button"
								onClick={() => setActiveImage(i)}
								aria-label={`Kuva ${i + 1}`}
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

			{/* Fullscreen lightbox */}
			{lightboxOpen ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
					onClick={() => setLightboxOpen(false)}
					onKeyDown={() => {}}
					role="dialog"
					aria-modal="true"
					aria-label="Kuvagalleria"
				>
					<button
						type="button"
						onClick={() => setLightboxOpen(false)}
						className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
						aria-label="Sulje"
					>
						<X className="h-6 w-6" />
					</button>
					<img
						src={images[activeImage]?.url}
						alt={title}
						className="max-h-[90vh] max-w-[90vw] object-contain"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					/>
					{images.length > 1 && (
						<>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									prev();
								}}
								className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
								aria-label="Edellinen kuva"
							>
								<ChevronLeft className="h-6 w-6" />
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									next();
								}}
								className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
								aria-label="Seuraava kuva"
							>
								<ChevronRight className="h-6 w-6" />
							</button>
							<span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white">
								{activeImage + 1} / {images.length}
							</span>
						</>
					)}
				</div>
			) : null}
		</>
	);
}

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
		<div data-testid="listing-detail" className="min-h-screen bg-background">
			<div className="mx-auto max-w-4xl px-4 py-8">
				{/* Back */}
				<Link
					data-testid="listing-detail-back"
					to="/ilmoitukset"
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

						<ListingSpecs listing={listing} makeName={makeName} modelName={modelName} />

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
				</div>
			</div>
		</div>
	);
}
