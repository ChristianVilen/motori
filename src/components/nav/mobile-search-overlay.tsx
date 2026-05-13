import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CitySelect } from "~/components/listings/city-select";
import { addRecentSearch, getRecentSearches } from "~/lib/recent-searches";

type Props = { open: boolean; onClose: () => void };

const CATEGORIES = [
	{ key: "sale", to: "/pyorat/myynti" },
	{ key: "rental", to: "/pyorat/vuokraus" },
	{ key: "gear", to: "/varusteet" },
	{ key: "parts", to: "/varaosat" },
] as const;

export function MobileSearchOverlay({ open, onClose }: Props) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [q, setQ] = useState("");
	const [recent, setRecent] = useState<string[]>([]);

	useEffect(() => {
		if (!open) {
			return;
		}
		setRecent(getRecentSearches());
		setQ("");
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
	}, [open, onClose]);

	if (!open) {
		return null;
	}

	function runQuery(query: string) {
		const trimmed = query.trim();
		if (!trimmed) {
			return;
		}
		addRecentSearch(trimmed);
		navigate({ to: "/pyorat/myynti", search: { q: trimmed } });
		onClose();
	}

	function goCity(city: string, _region: string) {
		if (!city) {
			return;
		}
		navigate({ to: "/pyorat/myynti", search: { city } });
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
					<div className="grid grid-cols-2 gap-2">
						{CATEGORIES.map((c) => (
							<button
								key={c.key}
								type="button"
								onClick={() => {
									navigate({ to: c.to });
									onClose();
								}}
								className="rounded-md border border-border bg-background px-3 py-3 text-left text-sm font-medium hover:bg-accent/5"
							>
								{t(`nav.${c.key}`)}
							</button>
						))}
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
