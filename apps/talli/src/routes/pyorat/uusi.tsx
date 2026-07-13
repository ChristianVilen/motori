import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { UploadedPhoto } from "~/components/photo-upload";
import { RecurrenceDatesEditor, toAnchors } from "~/components/recurrence-dates-editor";
import { type PresetKey, REMINDER_PRESETS } from "~/lib/constants";
import { usePhotoUpload } from "~/lib/use-photo-upload";
import { useSubmit } from "~/lib/use-submit";
import { createVehicle } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/uusi")({
	component: NewVehiclePage,
});

function NewVehiclePage() {
	const navigate = useNavigate();
	const [make, setMake] = useState("");
	const [model, setModel] = useState("");
	const [year, setYear] = useState("");
	const [nickname, setNickname] = useState("");
	const [plate, setPlate] = useState("");
	const [odometer, setOdometer] = useState("");
	const [photo, setPhoto] = useState<UploadedPhoto | null>(null);
	type PresetDraft = {
		checked: boolean;
		interval_km: string;
		interval_months: string;
		dates: string[]; // full YYYY-MM-DD for the picker
	};
	const [drafts, setDrafts] = useState<Record<PresetKey, PresetDraft>>(
		() =>
			Object.fromEntries(
				REMINDER_PRESETS.map((p) => [
					p.key,
					{
						checked: true,
						interval_km: p.type === "interval" && p.interval_km ? String(p.interval_km) : "",
						interval_months:
							p.type === "interval" && p.interval_months ? String(p.interval_months) : "",
						dates: p.type === "date" ? [""] : [],
					},
				]),
			) as Record<PresetKey, PresetDraft>,
	);
	const { saving, submit } = useSubmit();
	const { uploading, upload } = usePhotoUpload();

	function patchDraft(key: PresetKey, patch: Partial<PresetDraft>) {
		setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
	}

	async function handlePhoto(file: File | undefined) {
		const uploaded = await upload(file);
		if (uploaded) {
			setPhoto(uploaded);
		}
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		await submit(async () => {
			const { id } = await createVehicle({
				data: {
					make,
					model,
					year: year ? Number(year) : null,
					nickname: nickname || null,
					plate: plate || null,
					vin: null,
					odometer_km: Number(odometer) || 0,
					photo_url: photo?.url ?? null,
					thumbnail_url: photo?.thumbnail_url ?? null,
					presets: REMINDER_PRESETS.filter((p) => drafts[p.key].checked).map((p) =>
						p.type === "interval"
							? {
									key: p.key,
									interval_km: drafts[p.key].interval_km ? Number(drafts[p.key].interval_km) : null,
									interval_months: drafts[p.key].interval_months
										? Number(drafts[p.key].interval_months)
										: null,
								}
							: { key: p.key, recurrence_dates: toAnchors(drafts[p.key].dates) },
					),
				},
			});
			navigate({ to: "/pyorat/$vehicleId", params: { vehicleId: id } });
		});
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto max-w-lg" data-testid="vehicle-form">
			<h1 className="font-heading text-2xl font-bold">Lisää pyörä</h1>

			<div className="mt-6 grid gap-4">
				<label htmlFor="make" className="grid gap-1 text-sm font-medium">
					Merkki *
					<Input
						id="make"
						data-testid="vehicle-make"
						value={make}
						onChange={(e) => setMake(e.target.value)}
						maxLength={50}
						required
					/>
				</label>
				<label htmlFor="model" className="grid gap-1 text-sm font-medium">
					Malli *
					<Input
						id="model"
						data-testid="vehicle-model"
						value={model}
						onChange={(e) => setModel(e.target.value)}
						maxLength={50}
						required
					/>
				</label>
				<div className="grid grid-cols-2 gap-4">
					<label htmlFor="year" className="grid gap-1 text-sm font-medium">
						Vuosimalli
						<Input
							id="year"
							data-testid="vehicle-year"
							type="number"
							min={1900}
							max={new Date().getFullYear() + 1}
							value={year}
							onChange={(e) => setYear(e.target.value)}
						/>
					</label>
					<label htmlFor="odometer_km" className="grid gap-1 text-sm font-medium">
						Mittarilukema (km) *
						<Input
							id="odometer_km"
							data-testid="vehicle-odometer"
							type="number"
							min={0}
							max={2_000_000}
							value={odometer}
							onChange={(e) => setOdometer(e.target.value)}
							required
						/>
					</label>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<label htmlFor="nickname" className="grid gap-1 text-sm font-medium">
						Lempinimi
						<Input
							id="nickname"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							maxLength={50}
						/>
					</label>
					<label htmlFor="plate" className="grid gap-1 text-sm font-medium">
						Rekisteritunnus
						<Input
							id="plate"
							value={plate}
							onChange={(e) => setPlate(e.target.value)}
							maxLength={20}
						/>
					</label>
				</div>
				<label className="grid gap-1 text-sm font-medium">
					Kuva
					<input
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onChange={(e) => handlePhoto(e.target.files?.[0])}
						className="text-sm"
					/>
					{uploading ? <span className="text-xs text-muted">Ladataan kuvaa…</span> : null}
					{photo ? <img src={photo.thumbnail_url} alt="" className="mt-2 h-24 rounded" /> : null}
				</label>
			</div>

			<fieldset className="mt-8">
				<legend className="text-sm font-medium">Muistutukset</legend>
				<p className="mt-1 text-xs text-muted">
					Valmiit muistutukset — voit muokata tai poistaa niitä myöhemmin.
				</p>
				<div className="mt-3 grid gap-3">
					{REMINDER_PRESETS.map((p) => {
						const draft = drafts[p.key];
						return (
							<div key={p.key} className="rounded-lg border border-border p-3">
								<label className="flex items-center gap-2 text-sm font-medium">
									<input
										type="checkbox"
										data-testid={`preset-${p.key}`}
										checked={draft.checked}
										onChange={(e) => patchDraft(p.key, { checked: e.target.checked })}
									/>
									{p.title}
								</label>
								{draft.checked && p.type === "interval" ? (
									<div className="mt-2 grid grid-cols-2 gap-2">
										<label htmlFor={`preset-${p.key}-km`} className="grid gap-1 text-xs text-muted">
											Km-väli
											<Input
												id={`preset-${p.key}-km`}
												type="number"
												min={1}
												max={200_000}
												data-testid={`preset-${p.key}-km`}
												value={draft.interval_km}
												onChange={(e) => patchDraft(p.key, { interval_km: e.target.value })}
											/>
										</label>
										<label
											htmlFor={`preset-${p.key}-months`}
											className="grid gap-1 text-xs text-muted"
										>
											Kk-väli
											<Input
												id={`preset-${p.key}-months`}
												type="number"
												min={1}
												max={120}
												data-testid={`preset-${p.key}-months`}
												value={draft.interval_months}
												onChange={(e) => patchDraft(p.key, { interval_months: e.target.value })}
											/>
										</label>
									</div>
								) : null}
								{draft.checked && p.type === "date" ? (
									<div className="mt-2">
										<p className="mb-1 text-xs text-muted">Eräpäivä(t) — voit lisätä toisen erän</p>
										<RecurrenceDatesEditor
											dates={draft.dates}
											onChange={(dates) => patchDraft(p.key, { dates })}
										/>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</fieldset>

			<Button
				type="submit"
				data-testid="vehicle-form-submit"
				disabled={saving || uploading}
				className="mt-8 w-full"
			>
				{saving ? "Tallennetaan…" : "Lisää pyörä"}
			</Button>
		</form>
	);
}
