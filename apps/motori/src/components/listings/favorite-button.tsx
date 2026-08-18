import { Heart } from "lucide-react";
import { useFavorites } from "~/lib/favorites-context";
import { useTranslation } from "~/lib/i18n";

interface FavoriteButtonProps {
	listingId: string;
	className?: string;
}

export function FavoriteButton({ listingId, className }: FavoriteButtonProps) {
	const { t } = useTranslation("listings");
	const { isFavorite, toggle } = useFavorites();
	const favorited = isFavorite(listingId);

	return (
		<button
			type="button"
			data-testid="favorite-button"
			className={
				className ??
				"absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-muted transition-transform hover:scale-110"
			}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				toggle(listingId);
			}}
			aria-pressed={favorited}
			aria-label={
				favorited ? t("card.removeFromFavoritesAriaLabel") : t("card.addToFavoritesAriaLabel")
			}
		>
			<Heart className={favorited ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4"} />
		</button>
	);
}
