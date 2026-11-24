import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { BROWSE_CATEGORIES } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";

const field =
	"h-[46px] w-full rounded-full border border-transparent bg-muted-light pl-11 pr-4 text-base hover:border-border";
const icon = "pointer-events-none absolute left-3.5 text-muted";
function useSiteSearchLocation() {
	return useRouterState({
		select: ({ location }) => ({
			category: BROWSE_CATEGORIES.find((c) => c.to === location.pathname),
			home: location.pathname === "/",
			q: typeof location.search.q === "string" ? location.search.q : "",
		}),
	});
}

export function SiteSearch() {
	const { t } = useTranslation("common");
	const { category, q } = useSiteSearchLocation();
	const navigate = useNavigate();
	return (
		<search className="relative hidden min-w-0 max-w-[560px] flex-1 md:block">
			<form
				data-testid="site-search-form"
				className="flex items-center"
				onSubmit={(event) => {
					event.preventDefault();
					const value = new FormData(event.currentTarget).get("q");
					const query = typeof value === "string" ? value.trim() : "";
					void navigate({
						to: category?.to ?? "/",
						search: (prev) => ({
							...(category ? prev : {}),
							q: query || undefined,
							cursor: undefined,
						}),
					});
				}}
			>
				<Search size={20} aria-hidden="true" className={icon} />
				<input
					key={JSON.stringify([category?.to, q])}
					name="q"
					type="search"
					data-testid="site-search-input"
					defaultValue={q}
					aria-label={t("nav.search.sitePlaceholder")}
					placeholder={t("nav.search.sitePlaceholder")}
					className={`${field} placeholder:text-muted`}
				/>
			</form>
		</search>
	);
}

export function MobileSearchTrigger({ onOpen }: { onOpen: () => void }) {
	const { t } = useTranslation("common");
	const { category, home, q } = useSiteSearchLocation();
	return category || home ? (
		<button
			type="button"
			data-testid="site-search-trigger"
			onClick={onOpen}
			className={`${field} relative mb-1.5 flex items-center text-left text-muted md:hidden`}
		>
			<Search size={20} aria-hidden="true" className={icon} />
			<span className="truncate">{q || t("nav.search.sitePlaceholder")}</span>
		</button>
	) : null;
}
