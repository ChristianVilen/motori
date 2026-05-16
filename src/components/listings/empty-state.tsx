import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "~/lib/i18n";
import { getNeighborRegionCount } from "~/lib/listings-stats";
import { useEmailVerified } from "~/lib/use-email-verified";
import type { BrowseSearchParams } from "~/lib/validators";

interface EmptyStateProps {
	search: BrowseSearchParams;
}

export function EmptyState({ search }: EmptyStateProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const [neighborCount, setNeighborCount] = useState<number | null>(null);

	useEffect(() => {
		if (search.region) {
			getNeighborRegionCount({ data: search.region })
				.then(setNeighborCount)
				.catch(() => setNeighborCount(null));
		}
	}, [search.region]);

	function clearRegion() {
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ ...prev, region: undefined, cursor: undefined }),
			replace: true,
		});
	}

	function clearAll() {
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ view: prev.view, city: prev.city }),
			replace: true,
		});
	}

	return (
		<div
			data-testid="listings-empty-state"
			className="flex flex-col items-center py-16 text-center"
		>
			<Search className="mb-4 h-12 w-12 text-border" />
			<h3 className="font-heading text-lg font-semibold text-foreground">{t("empty.heading")}</h3>
			<p className="mt-1 text-sm text-muted">{t("empty.body")}</p>

			{!!search.region && neighborCount != null && neighborCount > 0 && (
				<p className="mt-4 text-sm text-foreground">
					<span className="font-semibold text-accent">
						{t("empty.neighborRegionsCount", { n: neighborCount })}
					</span>{" "}
					{t("empty.neighborRegionsSuffix")}
				</p>
			)}

			<div className="mt-6 flex gap-3">
				{!!search.region && (
					<button
						type="button"
						onClick={clearRegion}
						className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted-light"
					>
						{t("empty.expandSearch")}
					</button>
				)}
				<button
					type="button"
					onClick={clearAll}
					className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
				>
					{t("empty.clearFilters")}
				</button>
			</div>
		</div>
	);
}

export function LowResultNudge() {
	const { t } = useTranslation("listings");
	const { t: tAuth } = useTranslation("auth");
	const verified = useEmailVerified();
	return (
		<div className="mt-6 rounded-lg border border-border bg-muted-light px-4 py-3 text-center text-sm text-muted">
			{t("empty.lowResults")}{" "}
			{verified ? (
				<Link to="/ilmoitukset/uusi" className="font-medium text-accent hover:underline">
					{t("empty.lowResultsLink")}
				</Link>
			) : (
				<span
					title={tAuth("unverifiedTooltip")}
					className="cursor-not-allowed font-medium text-muted/50"
				>
					{t("empty.lowResultsLink")}
				</span>
			)}
			.
		</div>
	);
}
