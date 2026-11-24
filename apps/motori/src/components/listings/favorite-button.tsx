import { Heart } from "lucide-react";
import { useFavorites } from "~/lib/favorites-context";
import { useTranslation } from "~/lib/i18n";

export function FavoriteButton({
	listingId,
	title,
	className = "absolute top-0.5 right-0.5",
}: {
	listingId: string;
	title: string;
	className?: string;
}) {
	const { t } = useTranslation("listings");
	const { isFavorite, toggle } = useFavorites();
	const saved = isFavorite(listingId);
	return (
		<button
			type="button"
			data-testid="favorite-button"
			className={`${className} grid size-11 shrink-0 place-items-center rounded-full`}
			onClick={() => toggle(listingId)}
			aria-pressed={saved}
			aria-label={t(saved ? "card.removeFromFavoritesAriaLabel" : "card.addToFavoritesAriaLabel", {
				title,
			})}
		>
			<span
				className={`grid size-9 place-items-center rounded-full text-foreground ${saved ? "bg-reflector" : "bg-card"}`}
			>
				<Heart aria-hidden="true" size={19} fill={saved ? "currentColor" : "none"} />
			</span>
		</button>
	);
}
