import { Link } from "@tanstack/react-router";
import { ChevronRight, Star } from "lucide-react";
import { useTranslation } from "~/lib/i18n";
import type { ListingForDisplay } from "~/lib/listings-detail";

export function SellerAvatar({ name, large = false }: { name: string; large?: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={`grid shrink-0 place-items-center rounded-full bg-muted-light font-heading font-bold text-foreground ${large ? "size-16 text-2xl" : "size-11 text-lg"}`}
		>
			{Array.from(name.trim())[0]?.toLocaleUpperCase()}
		</span>
	);
}

export function SellerCard({
	data,
	summary,
}: {
	data: ListingForDisplay;
	summary: { averageRating: number | null; reviewCount: number };
}) {
	const { t, i18n } = useTranslation("listings");
	const name = data.ownerName || t("detail.sellerLabel");
	return (
		<Link
			data-testid="seller-profile-link"
			to="/profiili/$userId"
			params={{ userId: data.listing.owner_id }}
			className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 hover:border-foreground"
		>
			<SellerAvatar name={name} />
			<div className="min-w-0 flex-1">
				<p className="break-words font-semibold">{name}</p>
				<p className="mt-1 flex items-center gap-1 text-sm">
					{summary.averageRating === null ? (
						t("detail.noReviews")
					) : (
						<>
							<Star size={15} aria-hidden="true" fill="currentColor" />
							{t("detail.sellerRating", {
								rating: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(
									summary.averageRating,
								),
								count: summary.reviewCount,
							})}
						</>
					)}
				</p>
				<p className="mt-1 text-[13px] text-muted">
					{data.ownerCity}
					{data.ownerCity && data.ownerSince ? " · " : ""}
					{!!data.ownerSince && (
						<span data-testid="seller-member-since">
							{t("detail.memberSince", { year: new Date(data.ownerSince).getFullYear() })}
						</span>
					)}
				</p>
			</div>
			<ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
		</Link>
	);
}
