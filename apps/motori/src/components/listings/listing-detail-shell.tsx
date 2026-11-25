import { Link, type LinkProps, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { FavoriteButton } from "~/components/listings/favorite-button";
import { ListingGallery } from "~/components/listings/listing-gallery";
import { ShareButton } from "~/components/listings/share-button";
import { ReportButton } from "~/components/report-button";
import { categoryDetailPath } from "~/lib/category-routes";
import { LISTING_STATUSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { formatDate, formatEur, useTranslation } from "~/lib/i18n";
import type { ListingForDisplay } from "~/lib/listings-detail";
import { computeCategorySlug } from "~/lib/slug";
import { ListingFacts } from "./listing-facts";
import { NonRentalSidebar } from "./non-rental-sidebar";
import { SellerCard } from "./seller-card";

interface ReviewSummary {
	averageRating: number | null;
	reviewCount: number;
}

export interface ListingDetailShellProps {
	data: ListingForDisplay & { ownerReviewSummary: ReviewSummary };
	session: { user: { id: string } } | null;
	backTo: LinkProps["to"];
	sidebar?: ReactNode;
}

export function ListingDetailShell({ data, session, backTo, sidebar }: ListingDetailShellProps) {
	const { t } = useTranslation("listings");
	const router = useRouter();
	const canGoBack = useCanGoBack();
	const { listing, images, ownerReviewSummary } = data;
	const isOwner = session?.user.id === listing.owner_id;
	const price =
		data.sale?.price ?? data.gear?.price ?? data.part?.price ?? data.rental?.price_per_day;
	const buyerContact = listing.category !== "rental" && listing.status === "active" && !isOwner;
	const path = categoryDetailPath(
		listing.category,
		listing.short_id,
		computeCategorySlug(
			listing.category,
			listing.title,
			data.makeSlug,
			data.modelName,
			listing.city,
		),
	);
	const backContent = (
		<>
			<ChevronLeft size={20} aria-hidden="true" />
			{t("detail.back")}
		</>
	);
	const backClass =
		"-ml-1.5 inline-flex min-h-11 items-center rounded-full pr-3 text-sm font-medium hover:underline";
	return (
		<div
			data-testid="listing-detail"
			data-contact-primary={buyerContact || undefined}
			className="mx-auto max-w-[1304px] px-4 pb-6 data-[contact-primary]:pb-[calc(var(--action-height)+1.5rem)] min-[900px]:px-8 min-[900px]:data-[contact-primary]:pb-6"
		>
			<div className="flex items-center justify-between gap-3 pt-1 pb-2">
				<Link
					data-testid="listing-detail-back"
					to={backTo}
					className={backClass}
					onClick={(event) => {
						if (
							canGoBack &&
							event.button === 0 &&
							!event.metaKey &&
							!event.ctrlKey &&
							!event.shiftKey &&
							!event.altKey
						) {
							event.preventDefault();
							router.history.back();
						}
					}}
				>
					{backContent}
				</Link>
				<div className="flex items-center gap-2">
					<ShareButton title={listing.title} path={path} />
					{!isOwner && (
						<FavoriteButton
							listingId={listing.id}
							title={listing.title}
							className="border border-border bg-card aria-pressed:bg-reflector"
						/>
					)}
				</div>
			</div>
			{listing.status === "sold" && (
				<p
					data-testid="listing-sold-banner"
					className="mb-4 rounded-lg bg-muted-light px-4 py-3 text-sm"
				>
					{t("detail.soldBanner")}
				</p>
			)}
			{listing.status === "expired" && (
				<p
					data-testid="listing-expired-banner"
					className="mb-4 rounded-lg bg-muted-light px-4 py-3 text-sm"
				>
					{t("detail.expiredBanner")}
				</p>
			)}
			<div className="flex min-w-0 flex-col min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_360px] min-[900px]:items-start min-[900px]:gap-12">
				<div className="contents min-[900px]:block min-[900px]:min-w-0">
					<ListingHeading listing={listing} isOwner={isOwner} />
					<div className="order-1 min-w-0">
						<ListingGallery key={listing.id} images={images} title={listing.title} />
					</div>
					<ListingFacts data={data} />
					<section className="order-5 mt-7">
						<h2 className="mb-2 text-lg font-bold">{t("detail.description")}</h2>
						<p className="max-w-[62ch] whitespace-pre-line break-words leading-relaxed">
							{listing.description}
						</p>
					</section>
					{!!session && (
						<div className="order-9 mt-7">
							<ReportButton targetType="listing" targetId={listing.id} />
						</div>
					)}
				</div>
				<aside className="contents min-[900px]:sticky min-[900px]:top-[calc(var(--header-height)+1rem)] min-[900px]:grid min-[900px]:gap-5 min-[900px]:rounded-lg min-[900px]:border min-[900px]:border-border min-[900px]:bg-card min-[900px]:p-[22px]">
					{price != null && <ListingPrice data={data} price={price} />}
					<div className="order-6">
						{listing.category === "rental" ? (
							sidebar
						) : (
							<NonRentalSidebar
								key={listing.id}
								listing={listing}
								isOwner={isOwner}
								currentUserId={session?.user.id}
								ownerPhoneVisible={data.ownerPhoneVisible}
								price={price}
							/>
						)}
					</div>
					{!isOwner && (
						<div className="order-7 mt-7 min-[900px]:mt-0">
							<SellerCard data={data} summary={ownerReviewSummary} />
						</div>
					)}
					{listing.category === "sale" && (
						<Link
							to="/kauppakirja"
							search={{ ilmoitus: listing.short_id }}
							aria-label={t("contract:link")}
							className="order-8 mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-foreground min-[900px]:mt-0"
						>
							<FileText size={22} aria-hidden="true" className="shrink-0" />
							<div className="min-w-0 flex-1">
								<span className="font-semibold">{t("contract:link")}</span>
								<p className="mt-1 text-[13px] text-muted">{t("contract:linkHint")}</p>
							</div>
							<ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
						</Link>
					)}
				</aside>
			</div>
		</div>
	);
}

function ListingHeading({
	listing,
	isOwner,
}: {
	listing: ListingForDisplay["listing"];
	isOwner: boolean;
}) {
	const { t } = useTranslation("listings");
	const region = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel = MOTORCYCLE_TYPES.find((v) => v.value === listing.motorcycle_type)?.label;
	const chip = "inline-flex items-center rounded-full bg-muted-light px-[11px] py-1 text-[13px]";
	return (
		<div className="order-3 min-[900px]:mb-4">
			<h1
				data-testid="listing-detail-title"
				className="mt-1.5 break-words font-heading text-[22px] leading-tight font-bold tracking-tight min-[900px]:mt-0 min-[900px]:text-[32px]"
			>
				{listing.title}
			</h1>
			<div className="mt-3.5 flex flex-wrap gap-1.5">
				{!!typeLabel && (
					<span data-testid="listing-type" className={chip}>
						{typeLabel}
					</span>
				)}
				<span data-testid="location-info" className={chip}>
					{listing.city}, {region}
				</span>
				<span data-testid="listing-posted-date" className={chip}>
					{t("detail.postedOn", { date: formatDate(new Date(listing.created_at)) })}
				</span>
				{!!listing.required_license && (
					<span className={chip}>
						{t("detail.licenseBadge", { license: listing.required_license })}
					</span>
				)}
				{isOwner ? <span className={chip}>{t("card.ownBadge")}</span> : null}
				{listing.status !== "active" && (
					<span data-testid="listing-status-badge" className={chip}>
						{LISTING_STATUSES[listing.status]}
					</span>
				)}
			</div>
		</div>
	);
}

function ListingPrice({ data, price }: { data: ListingForDisplay; price: number }) {
	const { listing } = data;
	const { t } = useTranslation("listings");
	return (
		<div className="order-2 mt-[18px] min-[900px]:mt-0" data-testid="price-info">
			<span
				data-testid={listing.category === "rental" ? "price-per-day" : `price-${listing.category}`}
				className="font-heading text-[30px] leading-[1.1] font-extrabold tracking-[-0.035em] tabular-nums"
			>
				{formatEur(price)}
			</span>
			{!!data.sale?.negotiable && (
				<span className="ml-3 text-[13px] text-muted">{t("detail.negotiable")}</span>
			)}
			{!!data.rental && (
				<>
					<span className="ml-1 text-sm text-muted">{t("card.perDay")}</span>
					{data.rental.price_per_week != null && (
						<p data-testid="price-per-week" className="mt-1 text-sm text-muted tabular-nums">
							{t("detail.pricing.perWeek", {
								price: formatEur(data.rental.price_per_week),
							})}
						</p>
					)}
					{data.rental.price_per_weekend != null && (
						<p data-testid="price-per-weekend" className="text-sm text-muted tabular-nums">
							{t("detail.pricing.perWeekend", {
								price: formatEur(data.rental.price_per_weekend),
							})}
						</p>
					)}
					{!!data.rental.price_description && (
						<p className="mt-1 text-sm text-muted">{data.rental.price_description}</p>
					)}
				</>
			)}
		</div>
	);
}
