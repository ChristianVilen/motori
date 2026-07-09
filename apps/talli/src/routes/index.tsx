import { Button } from "@motori/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DueBadge, dueDetail } from "~/components/due-badge";
import { vehicleLabel } from "~/lib/format";
import { getGarage } from "~/lib/vehicles";

export const Route = createFileRoute("/")({
	loader: async () => ({ vehicles: await getGarage() }),
	component: GaragePage,
});

function GaragePage() {
	const { vehicles } = Route.useLoaderData();
	const { session } = Route.useRouteContext();

	if (!session) {
		return (
			<div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
				<h1 className="font-heading text-3xl font-bold">Talli</h1>
				<p className="mt-3 max-w-md text-sm text-muted">
					Huoltokirja, muistutukset ja mittarilukemat moottoripyörällesi. Kirjaudu sisään
					Motori-tunnuksillasi.
				</p>
			</div>
		);
	}

	if (vehicles.length === 0) {
		return (
			<div
				data-testid="garage-empty"
				className="flex min-h-[50vh] flex-col items-center justify-center text-center"
			>
				<h1 className="font-heading text-2xl font-bold">Tallisi on tyhjä</h1>
				<p className="mt-2 text-sm text-muted">
					Lisää ensimmäinen pyöräsi ja pidä huolto ajan tasalla.
				</p>
				<Button asChild className="mt-6">
					<Link to="/pyorat/uusi" data-testid="garage-add-vehicle">
						Lisää pyörä
					</Link>
				</Button>
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between">
				<h1 className="font-heading text-2xl font-bold">Talli</h1>
				<Button asChild size="sm">
					<Link to="/pyorat/uusi" data-testid="garage-add-vehicle">
						Lisää pyörä
					</Link>
				</Button>
			</div>
			<ul className="mt-6 grid gap-4 sm:grid-cols-2">
				{vehicles.map((v) => (
					<li key={v.id}>
						<Link
							to="/pyorat/$vehicleId"
							params={{ vehicleId: v.id }}
							data-testid="vehicle-card"
							data-vehicle-id={v.id}
							className="block rounded-lg border border-border p-4 hover:border-accent"
						>
							{v.thumbnail_url ? (
								<img
									src={v.thumbnail_url}
									alt=""
									className="mb-3 h-32 w-full rounded object-cover"
								/>
							) : null}
							<div className="font-heading font-semibold">{vehicleLabel(v)}</div>
							<div className="text-sm text-muted">
								{v.make} {v.model}
								{v.year ? ` · ${v.year}` : ""} · {v.odometer_km.toLocaleString("fi-FI")} km
							</div>
							{v.nextDue ? (
								<div className="mt-2 flex items-center gap-2 text-sm">
									<DueBadge state={v.nextDue.state} />
									<span className="text-muted">
										{v.nextDue.title}
										{dueDetail(v.nextDue.state) ? ` — ${dueDetail(v.nextDue.state)}` : ""}
									</span>
								</div>
							) : null}
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
