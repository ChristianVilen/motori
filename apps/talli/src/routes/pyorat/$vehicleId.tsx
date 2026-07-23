import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { DocumentsSection } from "~/components/documents-section";
import { DueBadge, dueDetail } from "~/components/due-badge";
import { MOTORI_URL } from "~/lib/constants";
import { parseLocalDate } from "~/lib/due-state";
import { formatEur, vehicleLabel } from "~/lib/format";
import { markReminderPaid } from "~/lib/reminders";
import { useSubmit } from "~/lib/use-submit";
import { getVehicleDetail, updateOdometer } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/$vehicleId")({
	loader: async ({ params, context }) => {
		if (!context.session) {
			throw redirect({ to: "/" });
		}
		return getVehicleDetail({ data: { vehicleId: params.vehicleId } });
	},
	component: VehicleDetailPage,
});

function VehicleDetailPage() {
	const { vehicle, reminders, records, documents } = Route.useLoaderData();
	const router = useRouter();
	const [reading, setReading] = useState("");
	const { saving, submit } = useSubmit();
	const partsUrl = `${MOTORI_URL}/varaosat?q=${encodeURIComponent(`${vehicle.make} ${vehicle.model}`)}`;

	async function handleOdometer(e: React.FormEvent) {
		e.preventDefault();
		await submit(async () => {
			await updateOdometer({
				data: { vehicle_id: vehicle.id, reading_km: Number(reading) },
			});
			setReading("");
			router.invalidate();
		});
	}

	async function handlePaid(id: string) {
		await submit(async () => {
			await markReminderPaid({ data: { id } });
			router.invalidate();
		});
	}

	return (
		<div data-testid="vehicle-detail">
			<Link to="/" className="text-sm text-muted hover:text-foreground">
				← Talli
			</Link>
			<div className="mt-2 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-heading text-2xl font-bold" data-testid="vehicle-title">
						{vehicleLabel(vehicle)}
					</h1>
					<p className="text-sm text-muted">
						{vehicle.make} {vehicle.model}
						{vehicle.year ? ` · ${vehicle.year}` : ""}
						{vehicle.plate ? ` · ${vehicle.plate}` : ""}
					</p>
				</div>
				{vehicle.photo_url ? (
					<img src={vehicle.photo_url} alt="" className="h-24 rounded object-cover" />
				) : null}
			</div>

			<section className="mt-6 rounded-lg border border-border p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<span className="text-sm text-muted">Mittarilukema</span>
						<div className="font-heading text-xl font-bold" data-testid="vehicle-odometer-value">
							{vehicle.odometer_km.toLocaleString("fi-FI")} km
						</div>
					</div>
					<form onSubmit={handleOdometer} className="flex items-center gap-2">
						<Input
							type="number"
							min={0}
							max={2_000_000}
							placeholder="Uusi lukema"
							data-testid="odometer-input"
							value={reading}
							onChange={(e) => setReading(e.target.value)}
							className="w-36"
						/>
						<Button
							type="submit"
							size="sm"
							data-testid="odometer-submit"
							disabled={!reading || saving}
						>
							Päivitä
						</Button>
					</form>
				</div>
			</section>

			<section className="mt-6">
				<div className="flex items-center justify-between">
					<h2 className="font-heading text-lg font-semibold">Muistutukset</h2>
					<Link
						to="/pyorat/$vehicleId/muistutukset"
						params={{ vehicleId: vehicle.id }}
						data-testid="manage-reminders"
						className="text-sm text-accent hover:underline"
					>
						Hallitse
					</Link>
				</div>
				{reminders.length === 0 ? (
					<p className="mt-2 text-sm text-muted">Ei muistutuksia.</p>
				) : (
					<ul className="mt-3 grid gap-2">
						{reminders.map((r) => (
							<li
								key={r.id}
								data-testid="reminder-row"
								data-reminder-title={r.title}
								className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
							>
								<div className="flex items-center gap-3">
									<DueBadge state={r.state} />
									<div>
										<div className="text-sm font-medium">{r.title}</div>
										<div className="text-xs text-muted">{dueDetail(r.state)}</div>
									</div>
								</div>
								{r.recurrence_dates ? (
									<Button
										size="sm"
										variant="outline"
										data-testid={`mark-paid-${r.title}`}
										disabled={saving}
										onClick={() => handlePaid(r.id)}
									>
										Merkitse maksetuksi
									</Button>
								) : (
									<Button asChild size="sm" variant="outline">
										<Link
											to="/pyorat/$vehicleId/huolto/uusi"
											params={{ vehicleId: vehicle.id }}
											search={{ reminder: r.id }}
											data-testid={`complete-reminder-${r.title}`}
										>
											Merkitse tehdyksi
										</Link>
									</Button>
								)}
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="mt-8">
				<div className="flex items-center justify-between">
					<h2 className="font-heading text-lg font-semibold">Huoltokirja</h2>
					<Button asChild size="sm">
						<Link
							to="/pyorat/$vehicleId/huolto/uusi"
							params={{ vehicleId: vehicle.id }}
							search={{ reminder: undefined }}
							data-testid="add-service-record"
						>
							Lisää huolto
						</Link>
					</Button>
				</div>
				{records.length === 0 ? (
					<p className="mt-2 text-sm text-muted">Ei vielä merkintöjä.</p>
				) : (
					<ol className="mt-3 grid gap-3" data-testid="service-timeline">
						{records.map((rec) => (
							<li
								key={rec.id}
								data-testid="service-record"
								className="rounded-lg border border-border p-4"
							>
								<div className="flex flex-wrap items-baseline justify-between gap-2">
									<span className="font-medium">{rec.title}</span>
									<span className="text-xs text-muted">
										{parseLocalDate(rec.performed_at).toLocaleDateString("fi-FI")}
										{rec.odometer_km != null
											? ` · ${rec.odometer_km.toLocaleString("fi-FI")} km`
											: ""}
										{rec.cost_cents != null ? ` · ${formatEur(rec.cost_cents)}` : ""}
									</span>
								</div>
								{rec.notes ? <p className="mt-1 text-sm text-muted">{rec.notes}</p> : null}
								{rec.parts ? <p className="mt-1 text-xs text-muted">Osat: {rec.parts}</p> : null}
								{rec.photos.length > 0 ? (
									<div className="mt-2 flex gap-2">
										{rec.photos.map((p) => (
											<a key={p.id} href={p.url} target="_blank" rel="noreferrer">
												<img src={p.thumbnail_url} alt="" className="h-16 rounded object-cover" />
											</a>
										))}
									</div>
								) : null}
							</li>
						))}
					</ol>
				)}
			</section>

			<DocumentsSection vehicleId={vehicle.id} documents={documents} />

			<section className="mt-8 rounded-lg border border-border p-4">
				<h2 className="font-heading text-lg font-semibold">Varaosat</h2>
				<p className="mt-1 text-sm text-muted">Löydä osia pyörääsi Motorin varaosatorilta.</p>
				<Button asChild variant="outline" size="sm" className="mt-3">
					<a href={partsUrl} data-testid="parts-search-link">
						Varaosat: {vehicle.make} {vehicle.model} →
					</a>
				</Button>
			</section>
		</div>
	);
}
