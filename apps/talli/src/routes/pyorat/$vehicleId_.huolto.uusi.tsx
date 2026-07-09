import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { Textarea } from "@motori/ui/textarea";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type UploadedPhoto, uploadPhoto } from "~/components/photo-upload";
import { MAX_PHOTOS_PER_RECORD } from "~/lib/constants";
import { formErrorMessage } from "~/lib/errors";
import { createServiceRecord } from "~/lib/service-records";
import { getVehicleDetail } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/$vehicleId_/huolto/uusi")({
	validateSearch: (search: Record<string, unknown>) => ({
		reminder: typeof search.reminder === "string" ? search.reminder : undefined,
	}),
	loader: async ({ params }) => getVehicleDetail({ data: { vehicleId: params.vehicleId } }),
	component: NewServiceRecordPage,
});

function NewServiceRecordPage() {
	const { vehicle, reminders } = Route.useLoaderData();
	const { reminder: reminderId } = Route.useSearch();
	const navigate = useNavigate();
	const completing = reminders.find((r) => r.id === reminderId);

	const [title, setTitle] = useState(completing?.title ?? "");
	const [performedAt, setPerformedAt] = useState(new Date().toISOString().slice(0, 10));
	const [odometer, setOdometer] = useState(String(vehicle.odometer_km));
	const [cost, setCost] = useState("");
	const [notes, setNotes] = useState("");
	const [parts, setParts] = useState("");
	const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
	const [uploading, setUploading] = useState(false);
	const [saving, setSaving] = useState(false);

	async function handlePhoto(file: File | undefined) {
		if (!file) {
			return;
		}
		if (photos.length >= MAX_PHOTOS_PER_RECORD) {
			toast.error(`Enintään ${MAX_PHOTOS_PER_RECORD} kuvaa.`);
			return;
		}
		setUploading(true);
		try {
			const photo = await uploadPhoto(file);
			setPhotos((prev) => [...prev, photo]);
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setUploading(false);
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			await createServiceRecord({
				data: {
					vehicle_id: vehicle.id,
					reminder_id: completing?.id ?? null,
					performed_at: performedAt,
					odometer_km: odometer ? Number(odometer) : null,
					title,
					notes: notes || null,
					cost_eur: cost ? Number(cost.replace(",", ".")) : null,
					parts: parts || null,
					photos,
				},
			});
			navigate({ to: "/pyorat/$vehicleId", params: { vehicleId: vehicle.id } });
		} catch (err) {
			toast.error(formErrorMessage(err));
			setSaving(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto max-w-lg" data-testid="service-form">
			<h1 className="font-heading text-2xl font-bold">Lisää huolto</h1>
			{completing ? (
				<p data-testid="completing-reminder" className="mt-1 text-sm text-accent">
					Merkitään tehdyksi: {completing.title}
				</p>
			) : null}

			<div className="mt-6 grid gap-4">
				<label htmlFor="service-title" className="grid gap-1 text-sm font-medium">
					Otsikko *
					<Input
						id="service-title"
						data-testid="service-title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						maxLength={100}
						required
					/>
				</label>
				<div className="grid grid-cols-2 gap-4">
					<label htmlFor="service-date" className="grid gap-1 text-sm font-medium">
						Päivämäärä *
						<Input
							id="service-date"
							data-testid="service-date"
							type="date"
							value={performedAt}
							onChange={(e) => setPerformedAt(e.target.value)}
							required
						/>
					</label>
					<label htmlFor="service-odometer" className="grid gap-1 text-sm font-medium">
						Mittarilukema (km)
						<Input
							id="service-odometer"
							data-testid="service-odometer"
							type="number"
							min={0}
							max={2_000_000}
							value={odometer}
							onChange={(e) => setOdometer(e.target.value)}
						/>
					</label>
				</div>
				<label htmlFor="service-cost" className="grid gap-1 text-sm font-medium">
					Kustannus (€)
					<Input
						id="service-cost"
						data-testid="service-cost"
						inputMode="decimal"
						value={cost}
						onChange={(e) => setCost(e.target.value)}
					/>
				</label>
				<label htmlFor="service-parts" className="grid gap-1 text-sm font-medium">
					Osat
					<Input
						id="service-parts"
						data-testid="service-parts"
						placeholder="esim. öljynsuodatin, 4l 10W-40"
						value={parts}
						onChange={(e) => setParts(e.target.value)}
						maxLength={2000}
					/>
				</label>
				<label htmlFor="service-notes" className="grid gap-1 text-sm font-medium">
					Muistiinpanot
					<Textarea
						id="service-notes"
						data-testid="service-notes"
						rows={4}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						maxLength={5000}
					/>
				</label>
				<label htmlFor="service-photo" className="grid gap-1 text-sm font-medium">
					Kuvat ({photos.length}/{MAX_PHOTOS_PER_RECORD})
					<input
						id="service-photo"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onChange={(e) => {
							handlePhoto(e.target.files?.[0]);
							e.target.value = "";
						}}
						className="text-sm"
					/>
					{uploading ? <span className="text-xs text-muted">Ladataan kuvaa…</span> : null}
				</label>
				{photos.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{photos.map((p, i) => (
							<button
								key={p.url}
								type="button"
								title="Poista kuva"
								onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
							>
								<img src={p.thumbnail_url} alt="" className="h-16 rounded object-cover" />
							</button>
						))}
					</div>
				) : null}
			</div>

			<Button
				type="submit"
				data-testid="service-form-submit"
				disabled={saving || uploading}
				className="mt-8 w-full"
			>
				{saving ? "Tallennetaan…" : "Tallenna huolto"}
			</Button>
		</form>
	);
}
