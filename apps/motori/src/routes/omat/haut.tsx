// src/routes/omat/haut.tsx
// Saved searches — bookmarked filter sets, tap to re-run, delete to forget.
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { categoryBrowsePath } from "~/lib/category-routes";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { getMakes } from "~/lib/makes";
import { savedSearchLabel } from "~/lib/saved-search-label";
import { deleteSavedSearchFn, getSavedSearchesFn } from "~/lib/saved-searches-fns";
import { requireSessionOrRedirect } from "~/lib/session";

export const Route = createFileRoute("/omat/haut")({
	loader: async ({ location }) => {
		await requireSessionOrRedirect(location.pathname);
		const [savedSearches, makes] = await Promise.all([getSavedSearchesFn(), getMakes()]);
		return { savedSearches, makes };
	},
	head: () => ({ meta: [{ title: `Tallennetut haut — ${SITE_NAME}` }] }),
	component: SavedSearchesPage,
});

function SavedSearchesPage() {
	const { savedSearches, makes } = Route.useLoaderData();
	const { t } = useTranslation("profile");
	const router = useRouter();

	async function handleDelete(id: string) {
		await deleteSavedSearchFn({ data: { id } });
		router.invalidate();
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-3xl px-4 py-8">
				<Link
					to="/omat"
					className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t("savedSearches.back")}
				</Link>

				<h1 className="mb-6 text-2xl font-bold text-primary">{t("savedSearches.title")}</h1>

				{savedSearches.length === 0 ? (
					<div className="rounded-lg border border-border bg-card py-16 text-center">
						<p className="text-muted">{t("savedSearches.empty")}</p>
					</div>
				) : (
					<div className="divide-y divide-border border-y border-border">
						{savedSearches.map((row) => {
							const label = savedSearchLabel(
								row.category,
								row.params,
								makes,
								row.category === "all"
									? t("listings:browse.categoryChips.all")
									: t(`listings:form.categories.${row.category}`),
							);
							return (
								<div
									key={row.id}
									data-testid="saved-search-row"
									className="flex items-center gap-2 py-2"
								>
									<Link
										to={categoryBrowsePath(row.category)}
										search={row.params}
										className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 text-sm font-medium text-foreground hover:underline"
									>
										{label}
										<ChevronRight size={16} className="shrink-0 text-muted" />
									</Link>
									<button
										type="button"
										onClick={() => handleDelete(row.id)}
										aria-label={t("savedSearches.delete", { label })}
										className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-muted-light hover:text-foreground"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
