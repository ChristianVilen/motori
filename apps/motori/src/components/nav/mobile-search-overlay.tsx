import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryChipClass } from "~/components/category-chip-class";
import { CitySelect } from "~/components/listings/city-select";
import { BROWSE_CATEGORIES, hasCategoryMap } from "~/lib/constants";
import { addRecentSearch, getRecentSearches } from "~/lib/recent-searches";
import { useFocusTrap } from "~/lib/use-focus-trap";
import { getBrowseCategory } from "./active-tab";

type Props = { onClose: () => void };

export function MobileSearchOverlay({ onClose }: Props) {
	const { t } = useTranslation();
	const { t: tListings } = useTranslation("listings");
	const navigate = useNavigate();
	const location = useRouterState({ select: (s) => s.location });
	const currentCategory = getBrowseCategory(location.pathname);
	const inputRef = useRef<HTMLInputElement>(null);
	const [q, setQ] = useState(typeof location.search.q === "string" ? location.search.q : "");
	const [category, setCategory] = useState(currentCategory);
	const [recent] = useState(getRecentSearches);
	const trapRef = useFocusTrap(true, inputRef);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, []);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
		};
	}, [onClose]);

	function runQuery(query: string) {
		const trimmed = query.trim();
		if (trimmed) {
			addRecentSearch(trimmed);
		}
		navigate({
			to: category.to,
			search: (prev) => ({
				...(category.value === currentCategory.value ? prev : {}),
				q: trimmed || undefined,
				cursor: undefined,
			}),
		});
		onClose();
	}

	function goCity(city: string) {
		if (!city) {
			return;
		}
		navigate({
			to: category.to,
			search: (prev) => ({
				...(category.value === currentCategory.value ? prev : {}),
				q: q.trim() || undefined,
				view: hasCategoryMap(category.value) ? "map" : undefined,
				city,
				cursor: undefined,
			}),
		});
		onClose();
	}

	return (
		<div
			ref={trapRef}
			role="dialog"
			aria-modal="true"
			aria-label={t("nav.search.title")}
			className="fixed inset-0 z-50 flex flex-col bg-background pb-[env(safe-area-inset-bottom)]"
		>
			<header className="flex items-center gap-2 border-b border-border px-4 py-3">
				<h2 className="flex-1 text-base font-semibold">{t("nav.search.title")}</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label={t("nav.search.close")}
					className="grid size-11 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-muted-light"
				>
					<X size={20} />
				</button>
			</header>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					runQuery(q);
				}}
				className="border-b border-border px-4 py-3"
			>
				<div className="flex items-center gap-2 rounded-full border border-transparent bg-muted-light py-1 pr-1 pl-4 focus-within:ring-2 focus-within:ring-ring">
					<SearchIcon size={18} className="text-muted" />
					<input
						ref={inputRef}
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t("nav.search.placeholder")}
						aria-label={t("nav.search.title")}
						className="min-w-0 flex-1 bg-transparent outline-none"
					/>
					<button
						type="submit"
						className="min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
					>
						{t("nav.search.submit")}
					</button>
				</div>
			</form>

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<section>
					<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
						{t("nav.search.categories")}
					</h3>
					<div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
						{BROWSE_CATEGORIES.map((c) => {
							const isActive = c.value === category.value;
							return (
								<button
									key={c.value}
									type="button"
									aria-pressed={isActive}
									data-testid={`search-overlay-category-chip-${c.value}`}
									onClick={() => setCategory(c)}
									className={categoryChipClass(isActive)}
								>
									{tListings(`browse.categoryChips.${c.value}`)}
								</button>
							);
						})}
					</div>
				</section>

				<section className="mt-6">
					<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
						{t("nav.search.cities")}
					</h3>
					<CitySelect value="" onChange={goCity} id="mobile-search-city" />
				</section>

				{recent.length > 0 && (
					<section className="mt-6">
						<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
							{t("nav.search.recent")}
						</h3>
						<ul className="divide-y divide-border">
							{recent.map((r) => (
								<li key={r}>
									<button
										type="button"
										onClick={() => runQuery(r)}
										className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-foreground"
									>
										<SearchIcon size={16} className="text-muted" />
										{r}
									</button>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</div>
	);
}
