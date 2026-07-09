import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { DueBadge, dueDetail } from "~/components/due-badge";
import type { ReminderType } from "~/lib/db/schema";
import { parseLocalDate } from "~/lib/due-state";
import { formErrorMessage } from "~/lib/errors";
import { formatInterval, vehicleLabel } from "~/lib/format";
import { createReminder, deleteReminder } from "~/lib/reminders";
import { useSubmit } from "~/lib/use-submit";
import { getVehicleDetail } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/$vehicleId_/muistutukset")({
	loader: async ({ params, context }) => {
		if (!context.session) {
			throw redirect({ to: "/" });
		}
		return getVehicleDetail({ data: { vehicleId: params.vehicleId } });
	},
	component: RemindersPage,
});

function RemindersPage() {
	const { vehicle, reminders } = Route.useLoaderData();
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [type, setType] = useState<ReminderType>("interval");
	const [intervalKm, setIntervalKm] = useState("");
	const [intervalMonths, setIntervalMonths] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const { saving, submit } = useSubmit();

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		await submit(async () => {
			await createReminder({
				data: {
					vehicle_id: vehicle.id,
					type,
					title,
					interval_km: intervalKm ? Number(intervalKm) : null,
					interval_months: intervalMonths ? Number(intervalMonths) : null,
					last_done_at: null,
					last_done_km: null,
					due_date: dueDate || null,
				},
			});
			setTitle("");
			setIntervalKm("");
			setIntervalMonths("");
			setDueDate("");
			router.invalidate();
		});
	}

	async function handleDelete(id: string) {
		if (!window.confirm("Poistetaanko muistutus?")) {
			return;
		}
		setDeletingId(id);
		try {
			await deleteReminder({ data: { id } });
			router.invalidate();
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<div className="mx-auto max-w-lg">
			<Link
				to="/pyorat/$vehicleId"
				params={{ vehicleId: vehicle.id }}
				className="text-sm text-muted hover:text-foreground"
			>
				← {vehicleLabel(vehicle)}
			</Link>
			<h1 className="mt-2 font-heading text-2xl font-bold">Muistutukset</h1>

			<ul className="mt-6 grid gap-2">
				{reminders.map((r) => (
					<li
						key={r.id}
						data-testid="reminder-row"
						data-reminder-title={r.title}
						className="flex items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
					>
						<div className="flex items-center gap-3">
							<DueBadge state={r.state} />
							<div>
								<div className="text-sm font-medium">{r.title}</div>
								<div className="text-xs text-muted">
									{r.type === "interval"
										? formatInterval(r.interval_km, r.interval_months, " välein")
										: `eräpäivä ${r.due_date ? parseLocalDate(r.due_date).toLocaleDateString("fi-FI") : "—"}`}
									{dueDetail(r.state) ? ` · ${dueDetail(r.state)}` : ""}
								</div>
							</div>
						</div>
						<Button
							size="sm"
							variant="ghost"
							data-testid="delete-reminder"
							disabled={deletingId === r.id}
							onClick={() => handleDelete(r.id)}
						>
							Poista
						</Button>
					</li>
				))}
			</ul>

			<form
				onSubmit={handleCreate}
				className="mt-8 rounded-lg border border-border p-4"
				data-testid="new-reminder-form"
			>
				<h2 className="font-heading text-lg font-semibold">Uusi muistutus</h2>
				<div className="mt-4 grid gap-4">
					<label htmlFor="new-reminder-title" className="grid gap-1 text-sm font-medium">
						Otsikko *
						<Input
							id="new-reminder-title"
							data-testid="new-reminder-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={100}
							required
						/>
					</label>
					<div className="flex gap-4 text-sm">
						<label className="flex items-center gap-2">
							<input
								type="radio"
								name="reminder-type"
								checked={type === "interval"}
								onChange={() => setType("interval")}
							/>
							Väli (km/kk)
						</label>
						<label className="flex items-center gap-2">
							<input
								type="radio"
								name="reminder-type"
								checked={type === "date"}
								onChange={() => setType("date")}
							/>
							Eräpäivä
						</label>
					</div>
					{type === "interval" ? (
						<div className="grid grid-cols-2 gap-4">
							<label htmlFor="new-reminder-km" className="grid gap-1 text-sm font-medium">
								Km-väli
								<Input
									id="new-reminder-km"
									type="number"
									min={1}
									max={200_000}
									data-testid="new-reminder-km"
									value={intervalKm}
									onChange={(e) => setIntervalKm(e.target.value)}
								/>
							</label>
							<label htmlFor="new-reminder-months" className="grid gap-1 text-sm font-medium">
								Kk-väli
								<Input
									id="new-reminder-months"
									type="number"
									min={1}
									max={120}
									data-testid="new-reminder-months"
									value={intervalMonths}
									onChange={(e) => setIntervalMonths(e.target.value)}
								/>
							</label>
						</div>
					) : (
						<label htmlFor="new-reminder-due-date" className="grid gap-1 text-sm font-medium">
							Eräpäivä *
							<Input
								id="new-reminder-due-date"
								type="date"
								data-testid="new-reminder-due-date"
								value={dueDate}
								onChange={(e) => setDueDate(e.target.value)}
								required={type === "date"}
							/>
						</label>
					)}
				</div>
				<Button type="submit" data-testid="new-reminder-submit" disabled={saving} className="mt-4">
					Lisää muistutus
				</Button>
			</form>
		</div>
	);
}
