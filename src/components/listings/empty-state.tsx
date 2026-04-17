import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { getNeighborRegionCount } from "~/lib/listings-queries";
import type { BrowseSearchParams } from "~/lib/validators";

interface EmptyStateProps {
	search: BrowseSearchParams;
}

export function EmptyState({ search }: EmptyStateProps) {
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
			to: "/listings",
			search: (prev) => ({ ...prev, region: undefined, cursor: undefined }),
			replace: true,
		});
	}

	function clearAll() {
		navigate({
			to: "/listings",
			search: {},
			replace: true,
		});
	}

	return (
		<div
			data-testid="listings-empty-state"
			className="flex flex-col items-center py-16 text-center"
		>
			<Search className="mb-4 h-12 w-12 text-border" />
			<h3 className="font-heading text-lg font-semibold text-foreground">
				Ei tuloksia näillä hakuehdoilla
			</h3>
			<p className="mt-1 text-sm text-muted">Kokeile laajentaa hakua tai poistaa suodattimia</p>

			{!!search.region && neighborCount != null && neighborCount > 0 && (
				<p className="mt-4 text-sm text-foreground">
					<span className="font-semibold text-accent">{neighborCount} pyörää</span> löytyi
					naapurimaakunnista
				</p>
			)}

			<div className="mt-6 flex gap-3">
				{!!search.region && (
					<button
						type="button"
						onClick={clearRegion}
						className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted-light"
					>
						Laajenna hakua
					</button>
				)}
				<button
					type="button"
					onClick={clearAll}
					className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
				>
					Tyhjennä suodattimet
				</button>
			</div>
		</div>
	);
}

export function LowResultNudge() {
	return (
		<div className="mt-6 rounded-lg border border-border bg-muted-light px-4 py-3 text-center text-sm text-muted">
			Vähän tuloksia? Kokeile laajentaa hakua tai{" "}
			<Link to="/listings/new" className="font-medium text-accent hover:underline">
				lisää oma ilmoituksesi
			</Link>
			.
		</div>
	);
}
