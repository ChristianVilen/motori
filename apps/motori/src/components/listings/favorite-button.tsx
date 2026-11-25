import { Heart } from "lucide-react";
import { useRef } from "react";
import { useFavorites } from "~/lib/favorites-context";
import { useTranslation } from "~/lib/i18n";
import { animateMotion } from "~/lib/motion";

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
	const glint = useRef<HTMLSpanElement>(null);
	const saved = isFavorite(listingId);
	return (
		<button
			type="button"
			data-testid="favorite-button"
			className={`${className} grid size-11 shrink-0 place-items-center rounded-full`}
			onClick={() => {
				const changed = toggle(listingId);
				const node = glint.current;
				if (!node) {
					return;
				}
				for (const animation of node.getAnimations?.() ?? []) {
					animation.cancel();
				}
				if (changed && !saved) {
					animateMotion(
						node,
						[
							{ opacity: 1, transform: "translateX(-62%)" },
							{ opacity: 1, transform: "translateX(62%)" },
						],
						{ duration: 450, delay: 60, easing: "cubic-bezier(0.45,0,0.3,1)" },
					);
				}
			}}
			aria-pressed={saved}
			aria-label={t(saved ? "card.removeFromFavoritesAriaLabel" : "card.addToFavoritesAriaLabel", {
				title,
			})}
		>
			<span
				className={`heart-disc relative overflow-hidden grid size-9 place-items-center rounded-full text-foreground ${saved ? "bg-reflector" : "bg-card"}`}
			>
				<span ref={glint} className="reflector-glint" aria-hidden="true" />
				<Heart aria-hidden="true" size={19} fill={saved ? "currentColor" : "none"} />
			</span>
		</button>
	);
}
