import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { ToriItemCard } from "~/components/tori/tori-item-card";
import { REGIONS, SITE_NAME, SITE_URL } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { TORI_CATEGORIES, TORI_CONDITIONS } from "~/lib/tori/constants";
import { searchToriItems, type ToriSearchResult } from "~/lib/tori/tori-queries";
import { toriBrowseSearchSchema } from "~/lib/tori/validators";

export const Route = createFileRoute("/tori/")({
	validateSearch: (search) => toriBrowseSearchSchema.parse(search),
	loaderDeps: ({ search }) => {
		const { ...deps } = search;
		return deps;
	},
	loader: async ({ deps }) => {
		return searchToriItems({ data: deps });
	},
	head: () => ({
		meta: [
			{ title: `Tori — ${SITE_NAME}` },
			{
				name: "description",
				content: "Osta ja myy moottoripyörävarusteita, osia ja tarvikkeita.",
			},
			{ property: "og:url", content: `${SITE_URL}/tori` },
		],
		links: [{ rel: "canonical", href: `${SITE_URL}/tori` }],
	}),
	component: ToriBrowsePage,
});

function ToriBrowsePage() {
	const { t } = useTranslation("common");
	const search = Route.useSearch();
	const data: ToriSearchResult = Route.useLoaderData();
	const navigate = useNavigate();
	const isLoading = useRouterState({ select: (s) => s.isLoading });

	const activeCategory = search.category ?? null;

	function updateSearch(updates: Record<string, unknown>) {
		navigate({
			to: "/tori",
			search: (prev) => ({ ...prev, ...updates, cursor: undefined }),
			replace: true,
		});
	}

	function handleSearch(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = (formData.get("q") as string)?.trim() || undefined;
		updateSearch({ q });
	}

	function loadMore() {
		if (!data.nextCursor) {
			return;
		}
		navigate({
			to: "/tori",
			search: (prev) => ({ ...prev, cursor: data.nextCursor ?? undefined }),
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="bg-primary px-4 py-6">
				<div className="mx-auto max-w-6xl">
					<h1 className="font-heading text-2xl font-bold text-white">Tori</h1>
					<p className="mt-1 text-sm text-white/70">Moottoripyörävarusteet, osat ja tarvikkeet</p>

					{/* Search */}
					<form onSubmit={handleSearch} className="mt-4 flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/50" />
							<input
								name="q"
								type="text"
								defaultValue={search.q ?? ""}
								placeholder="Hae varusteita..."
								data-testid="tori-search-input"
								className="h-11 w-full rounded-lg bg-white/10 pl-10 pr-4 text-sm text-white placeholder:text-white/70 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent"
							/>
						</div>
						<button
							type="submit"
							data-testid="tori-search-submit"
							className="h-11 rounded-lg bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover"
						>
							Hae
						</button>
					</form>
				</div>
			</div>

			{/* Category tabs */}
			<div className="border-b border-border bg-card">
				<div className="mx-auto max-w-6xl overflow-x-auto px-4">
					<div className="flex gap-1 py-2">
						<button
							type="button"
							onClick={() => updateSearch({ category: undefined })}
							className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
								!activeCategory
									? "bg-accent text-white"
									: "text-muted hover:bg-muted-light hover:text-foreground"
							}`}
						>
							Kaikki
						</button>
						{TORI_CATEGORIES.map((cat) => (
							<button
								key={cat.value}
								type="button"
								onClick={() => updateSearch({ category: cat.value })}
								className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
									activeCategory === cat.value
										? "bg-accent text-white"
										: "text-muted hover:bg-muted-light hover:text-foreground"
								}`}
							>
								{t(cat.labelKey)}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Filters row */}
			<div className="mx-auto max-w-6xl px-4 py-4">
				<div className="flex flex-wrap gap-2">
					<select
						value={search.condition ?? ""}
						onChange={(e) => updateSearch({ condition: e.target.value || undefined })}
						className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
						aria-label="Kunto"
						data-testid="tori-filter-condition"
					>
						<option value="">Kunto</option>
						{TORI_CONDITIONS.map((c) => (
							<option key={c.value} value={c.value}>
								{t(c.labelKey)}
							</option>
						))}
					</select>

					<select
						value={search.region ?? ""}
						onChange={(e) => updateSearch({ region: e.target.value || undefined })}
						className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
						aria-label="Maakunta"
						data-testid="tori-filter-region"
					>
						<option value="">Maakunta</option>
						{REGIONS.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</select>

					<select
						value={search.sort ?? ""}
						onChange={(e) => updateSearch({ sort: e.target.value || undefined })}
						className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
						data-testid="tori-filter-sort"
						aria-label="Järjestys"
					>
						<option value="">Uusimmat</option>
						<option value="price_asc">Halvin ensin</option>
						<option value="price_desc">Kallein ensin</option>
					</select>
				</div>

				{/* Result count */}
				<p className="mt-3 text-sm text-muted">
					<span className="font-semibold text-foreground">{data.totalCount}</span> ilmoitusta
				</p>
			</div>

			{/* Results grid */}
			<div className="mx-auto max-w-6xl px-4 pb-8">
				{data.items.length === 0 ? (
					<div className="py-16 text-center">
						<p className="text-lg font-medium text-foreground">Ei tuloksia</p>
						<p className="mt-2 text-sm text-muted">
							Kokeile muuttaa hakuehtoja tai poista suodattimia.
						</p>
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{data.items.map((item) => (
								<ToriItemCard key={item.id} item={item} images={item.images} />
							))}
						</div>

						{!!data.nextCursor && (
							<div className="mt-8 text-center">
								<button
									type="button"
									onClick={loadMore}
									disabled={isLoading}
									className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
								>
									Näytä lisää
								</button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
