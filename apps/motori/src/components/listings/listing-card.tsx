import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { ImageIcon } from "lucide-react";
import { FavoriteButton } from "~/components/listings/favorite-button";
import { categoryDetailPath } from "~/lib/category-routes";
import { LISTING_STATUSES } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { formatEur, formatNumber, useTranslation } from "~/lib/i18n";
import { photoStyle } from "~/lib/listing-photo-transition";
import type { ListingSummary } from "~/lib/listings-owner";
import { computeListingSlug } from "~/lib/slug";

type CardListing = Listing &
	Partial<Pick<ListingSummary, "price" | "km_driven" | "condition" | "size" | "part_category">>;
interface ListingCardProps {
	listing: CardListing;
	images: ListingImage[];
	makeSlug: string | null;
	modelName: string | null;
	isOwn?: boolean;
	sizes?: string;
}

function facts(listing: CardListing, t: TFunction) {
	const condition = listing.condition ? t(`form.conditions.${listing.condition}`) : null;
	switch (listing.category) {
		case "sale":
			return [
				listing.year,
				listing.km_driven != null ? `${formatNumber(listing.km_driven)} km` : null,
				listing.city,
			];
		case "rental":
			return [
				listing.year,
				listing.engine_cc != null ? `${listing.engine_cc} cc` : null,
				listing.city,
			];
		case "gear":
			return [
				listing.size ? t("card.size", { size: listing.size }) : null,
				condition,
				listing.city,
			];
		case "part":
			return [
				listing.part_category
					? t(`card.partCategory.${listing.part_category}`, { defaultValue: "" })
					: null,
				condition,
				listing.city,
			];
	}
}

const gridSizes =
	"auto, (min-width: 1304px) 234px, (min-width: 1200px) calc((100vw - 136px) / 5), (min-width: 900px) calc((100vw - 118px) / 4), (min-width: 640px) calc((100vw - 60px) / 3), calc((100vw - 42px) / 2)";

export function ListingCard({
	listing,
	images,
	makeSlug,
	modelName,
	isOwn,
	sizes = gridSizes,
}: ListingCardProps) {
	const { t } = useTranslation("listings");
	const image = images[0];
	const slug = computeListingSlug(makeSlug, modelName, listing.city);
	return (
		<article
			data-testid="listing-card"
			data-listing-id={listing.short_id}
			className="relative min-w-0"
		>
			<Link
				to={categoryDetailPath(listing.category, "$listingId", "$slug")}
				params={{ listingId: listing.short_id, slug }}
				state={(prev) =>
					image && prev.__TSR_key
						? { listingPhoto: { id: listing.short_id, sourceKey: prev.__TSR_key } }
						: {}
				}
				className="group block rounded-lg"
			>
				<div
					style={image ? photoStyle(listing.short_id) : undefined}
					className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted-light"
				>
					{image ? (
						<img
							src={image.thumbnail_url ?? image.url}
							srcSet={
								image.thumbnail_url ? `${image.thumbnail_url} 400w, ${image.url} 1600w` : undefined
							}
							sizes={sizes}
							alt={listing.title}
							loading="lazy"
							className="h-full w-full object-cover"
						/>
					) : (
						<div className="grid h-full place-items-center">
							<ImageIcon aria-hidden="true" className="size-10 text-border" />
						</div>
					)}
					<div className="absolute top-2 left-2 flex gap-1">
						{isOwn ? (
							<span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
								{t("card.ownBadge")}
							</span>
						) : null}
						{listing.status !== "active" && (
							<span
								data-testid="listing-card-status"
								className="rounded-full bg-muted-light px-2 py-0.5 text-xs font-semibold text-muted"
							>
								{LISTING_STATUSES[listing.status]}
							</span>
						)}
					</div>
					{listing.category === "rental" && (
						<span className="absolute bottom-2 left-2 rounded-full bg-primary px-[9px] py-[3px] text-xs font-semibold text-primary-foreground">
							{t("card.rental")}
						</span>
					)}
				</div>
				<p
					data-testid="listing-card-price"
					className="mt-[9px] font-heading text-[17px] leading-[1.2] font-bold tracking-[-0.02em] tabular-nums"
				>
					{formatEur(listing.price ?? 0)}
					{listing.category === "rental" && ` ${t("card.perDay")}`}
				</p>
				<h3
					data-testid="listing-card-title"
					className="mt-0.5 truncate font-sans text-[15px] leading-[1.35] font-medium group-hover:underline"
				>
					{listing.title}
				</h3>
				<p
					data-testid="listing-card-facts"
					className="mt-px truncate text-[13px] leading-[1.4] text-muted"
				>
					{facts(listing, t)
						.filter((v) => v != null && v !== "")
						.join(" · ")}
				</p>
			</Link>
			<FavoriteButton listingId={listing.id} title={listing.title} />
		</article>
	);
}
