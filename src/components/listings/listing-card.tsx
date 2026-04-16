// src/components/listings/listing-card.tsx
import { Link } from "@tanstack/react-router";
import { MapPin, Tag } from "lucide-react";
import { MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import type { Listing, ListingImage } from "~/lib/db/schema";

interface ListingCardProps {
	listing: Listing;
	images: ListingImage[];
}

export function ListingCard({ listing, images }: ListingCardProps) {
	const firstImage = images[0];
	const regionLabel = REGIONS.find((r) => r.value === listing.region)?.label ?? listing.region;
	const typeLabel =
		MOTORCYCLE_TYPES.find((t) => t.value === listing.motorcycle_type)?.label ??
		listing.motorcycle_type;
	const priceEur = Math.round(listing.price_per_day / 100);

	return (
		<Link
			to="/listings/$listingId"
			params={{ listingId: listing.id }}
			className="group block rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
		>
			{/* Image */}
			<div className="aspect-[4/3] overflow-hidden rounded-t-lg bg-muted-light">
				{firstImage ? (
					<img
						src={firstImage.url}
						alt={listing.title}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
			</div>

			{/* Content */}
			<div className="p-4">
				<div className="mb-1 flex items-start justify-between gap-2">
					<h3 className="line-clamp-2 text-sm font-semibold text-foreground leading-tight">
						{listing.title}
					</h3>
					{!!listing.required_license && (
						<span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
							{listing.required_license}
						</span>
					)}
				</div>

				<div className="mt-1 flex items-center gap-1 text-xs text-muted">
					<Tag className="h-3 w-3" />
					<span>{typeLabel}</span>
					<span>·</span>
					<span>{listing.year}</span>
					{!!listing.engine_cc && (
						<>
							<span>·</span>
							<span>{listing.engine_cc}cc</span>
						</>
					)}
				</div>

				<div className="mt-2 flex items-center justify-between">
					<div className="flex items-center gap-1 text-xs text-muted">
						<MapPin className="h-3 w-3" />
						<span>
							{listing.city}, {regionLabel}
						</span>
					</div>
					<div className="text-right">
						<span className="text-base font-bold text-accent">{priceEur} €</span>
						<span className="text-xs text-muted">/pv</span>
					</div>
				</div>
			</div>
		</Link>
	);
}
