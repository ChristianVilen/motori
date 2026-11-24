import { useFavorites } from "~/lib/favorites-context";
import { useTranslation } from "~/lib/i18n";

const badge =
	"inline-grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums";

export function FavoritesBadge() {
	const { count } = useFavorites();
	const { t } = useTranslation("common");
	return (
		count > 0 && (
			<span className={`${badge} bg-reflector text-foreground`}>
				<span aria-hidden="true">{count}</span>
				<span className="sr-only">{t("nav.favoriteCount", { count })}</span>
			</span>
		)
	);
}

export function UnreadBadge({ count }: { count: number }) {
	const { t } = useTranslation("common");
	return (
		count > 0 && (
			<span className={`${badge} bg-primary text-primary-foreground`}>
				<span aria-hidden="true">{count}</span>
				<span className="sr-only">{t("nav.unreadCount", { count })}</span>
			</span>
		)
	);
}
