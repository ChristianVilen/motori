import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { MOTORCYCLE_TYPES, REGIONS, TYPE_EMOJI } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { computeListingSlug } from "~/lib/slug";

interface ListingCardProps {
	listing: Listing & { price_per_day?: number };
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
	isOwn?: boolean;
}

export function ListingCard({ listing, images, makeSlug, modelName, isOwn }: ListingCardProps) {
	const { t } = useTranslation("listings");
	const firstImage = images[0];
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((mt) => mt.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const typeEmoji = listing.motorcycle_type ? (TYPE_EMOJI[listing.motorcycle_type] ?? "") : "";

	const isNew = Date.now() - new Date(listing.created_at).getTime() < 48 * 60 * 60 * 1000;
	const imageCount = images.length;
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	const detailRoute =
		listing.category === "sale"
			? "/pyorat/myynti/$listingId/$slug"
			: listing.category === "gear"
				? "/varusteet/$listingId/$slug"
				: listing.category === "part"
					? "/varaosat/$listingId/$slug"
					: "/pyorat/vuokraus/$listingId/$slug";

	return (
		<Link
			data-testid="listing-card"
			data-listing-id={listing.short_id}
			to={detailRoute}
			params={{ listingId: listing.short_id, slug }}
			className="group block overflow-hidden rounded-xl border border-border bg-card card-hover hover:card-hover-active"
		>
			{/* Image */}
			<div className="relative aspect-[16/10] overflow-hidden bg-muted-light">
				{firstImage ? (
					<img
						src={firstImage.url}
						alt={listing.title}
						loading="lazy"
						className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
					/>
				) : (
					<div className="flex h-full items-center justify-center">
						<svg
							className="h-12 w-12 text-border"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A1.5 1.5 0 0022.5 18.75V6.75A1.5 1.5 0 0021 5.25H3A1.5 1.5 0 001.5 6.75v12A1.5 1.5 0 003 20.25z"
							/>
						</svg>
					</div>
				)}

				{/* Badges overlay */}
				<div className="absolute top-2.5 left-2.5 flex gap-1.5">
					{isNew && (
						<span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-white">
							{t("card.newBadge")}
						</span>
					)}
					{isOwn ? (
						<span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
							{t("card.ownBadge")}
						</span>
					) : null}
				</div>

				{/* Favorite button placeholder */}
				<button
					type="button"
					className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-muted transition-transform hover:scale-110"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
					}}
					aria-label={t("card.addToFavoritesAriaLabel")}
				>
					<Heart className="h-4 w-4" />
				</button>

				{/* Frosted trust bar at bottom of image */}
				<div className="absolute right-0 bottom-0 left-0 flex items-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent px-3 pt-6 pb-2.5">
					{imageCount > 1 && (
						<span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
							📷 {imageCount}
						</span>
					)}
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="mb-1 flex items-start justify-between gap-2">
					<h3
						data-testid="listing-card-title"
						className="line-clamp-1 text-sm font-semibold text-foreground leading-tight"
					>
						{listing.title}
					</h3>
					{!!listing.required_license && (
						<span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
							{listing.required_license}
						</span>
					)}
				</div>

				<p className="mt-1 text-xs text-muted">
					{typeEmoji} {typeLabel}
					{listing.engine_cc ? ` · ${listing.engine_cc} cc` : ""}
				</p>

				{/* Footer with border-top */}
				<div className="mt-3 flex items-center justify-between border-t border-border pt-3">
					<span className="text-xs text-muted">
						{listing.city}, {regionLabel}
					</span>
					<div className="text-right">
						<span
							data-testid="listing-card-price"
							className="font-heading text-lg font-bold text-accent"
						>
							{formatEur(listing.price_per_day ?? 0)}
						</span>
						<span className="text-xs text-muted">{t("card.perDay")}</span>
					</div>
				</div>
			</div>
		</Link>
	);
}
