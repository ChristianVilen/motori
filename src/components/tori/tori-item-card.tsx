import { Link } from "@tanstack/react-router";
import type { ToriItem, ToriItemImage } from "~/lib/db/schema";
import { formatEur, useTranslation } from "~/lib/i18n";
import { slugify } from "~/lib/slug";
import { TORI_CATEGORIES, TORI_CONDITIONS } from "~/lib/tori/constants";

interface ToriItemCardProps {
	item: ToriItem;
	images: ToriItemImage[];
}

const CONDITION_COLORS: Record<string, string> = {
	new: "bg-green-100 text-green-800",
	excellent: "bg-blue-100 text-blue-800",
	good: "bg-gray-100 text-gray-800",
	fair: "bg-amber-100 text-amber-800",
	poor: "bg-red-100 text-red-800",
};

export function ToriItemCard({ item, images }: ToriItemCardProps) {
	const { t } = useTranslation("common");
	const firstImage = images[0];
	const conditionLabel =
		TORI_CONDITIONS.find((c) => c.value === item.condition)?.labelKey ?? item.condition;
	const categoryLabel =
		TORI_CATEGORIES.find((c) => c.value === item.category)?.labelKey ?? item.category;
	const conditionColor = CONDITION_COLORS[item.condition] ?? "bg-gray-100 text-gray-800";
	const isSold = item.status === "sold";
	const slug = slugify(item.title);

	return (
		<Link
			to="/tori/$itemId/$slug"
			params={{ itemId: item.short_id, slug }}
			data-testid="tori-item-card"
			data-item-id={item.short_id}
			className={`group block overflow-hidden rounded-xl border border-border bg-card card-hover hover:card-hover-active ${isSold ? "opacity-60" : ""}`}
		>
			{/* Image */}
			<div className="relative aspect-[16/10] overflow-hidden bg-muted-light">
				{firstImage ? (
					<img
						src={firstImage.thumbnail_url ?? firstImage.url}
						alt={item.title}
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

				{/* Sold badge */}
				{isSold && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/30">
						<span className="rounded-md bg-black/70 px-3 py-1 text-sm font-semibold text-white">
							Myyty
						</span>
					</div>
				)}

				{/* Condition badge */}
				<div className="absolute top-2.5 left-2.5">
					<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${conditionColor}`}>
						{t(conditionLabel)}
					</span>
				</div>
			</div>

			{/* Content */}
			<div className="p-4">
				<h3 className="line-clamp-1 text-sm font-semibold text-foreground leading-tight">
					{item.title}
				</h3>
				<p className="mt-1 text-xs text-muted">{t(categoryLabel)}</p>

				<div className="mt-3 flex items-center justify-between border-t border-border pt-3">
					<span className="text-xs text-muted">{item.city}</span>
					<span className="font-heading text-lg font-bold text-accent">
						{formatEur(item.price_cents)}
					</span>
				</div>
			</div>
		</Link>
	);
}
