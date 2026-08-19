import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryChipClass } from "~/components/category-chip";
import { CitySelect } from "~/components/listings/city-select";
import { BROWSE_CATEGORIES } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import { addRecentSearch, getRecentSearches } from "~/lib/recent-searches";
import { getBrowseCategory } from "./active-tab";

type Props = { open: boolean; onClose: () => void };

export function MobileSearchOverlay({ open, onClose }: Props) {
	const { t } = useTranslation();
	const { t: tListings } = useTranslation("listings");
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const inputRef = useRef<HTMLInputElement>(null);
	const [q, setQ] = useState("");
	const [category, setCategory] = useState<ListingCategory>("sale");
	const [recent, setRecent] = useState<string[]>([]);

	useEffect(() => {
		if (!open) {
			return;
		}
		setRecent(getRecentSearches());
		setQ("");
		setCategory(getBrowseCategory(pathname));
		document.body.style.overflow = "hidden";
		const t0 = window.setTimeout(() => inputRef.current?.focus(), 0);
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				onClose();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", onKey);
			window.clearTimeout(t0);
		};
	}, [open, onClose, pathname]);

	if (!open) {
		return null;
	}

	function categoryTo(): string {
		return BROWSE_CATEGORIES.find((c) => c.value === category)?.to ?? "/pyorat/myynti";
	}

	function runQuery(query: string) {
		const trimmed = query.trim();
		if (!trimmed) {
			return;
		}
		addRecentSearch(trimmed);
		navigate({ to: categoryTo(), search: { q: trimmed } });
		onClose();
	}

	function goCity(city: string, _region: string) {
		if (!city) {
			return;
		}
		navigate({ to: categoryTo(), search: { city } });
		onClose();
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={t("nav.search.title")}
			className="fixed inset-0 z-50 flex flex-col bg-background"
		>
			<header className="flex items-center gap-2 border-b border-border px-4 py-3">
				<h2 className="flex-1 text-base font-semibold">{t("nav.search.title")}</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label={t("nav.search.close")}
					className="rounded-md p-2 text-muted hover:text-foreground"
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
				<div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
					<SearchIcon size={18} className="text-muted" />
					<input
						ref={inputRef}
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t("nav.search.placeholder")}
						className="flex-1 bg-transparent outline-none"
					/>
					<button type="submit" className="text-sm font-medium text-accent">
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
							const isActive = c.value === category;
							return (
								<button
									key={c.value}
									type="button"
									aria-pressed={isActive}
									data-testid={`search-overlay-category-chip-${c.value}`}
									onClick={() => setCategory(c.value)}
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
										className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-accent"
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
