import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type UploadedPhoto, uploadPhoto } from "~/components/photo-upload";
import { type PresetKey, REMINDER_PRESETS } from "~/lib/constants";
import { formErrorMessage } from "~/lib/errors";
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
	const [presets, setPresets] = useState<PresetKey[]>(REMINDER_PRESETS.map((p) => p.key));
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);

	function togglePreset(key: PresetKey) {
		setPresets((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
	}

	async function handlePhoto(file: File | undefined) {
		if (!file) {
			return;
		}
		setUploading(true);
		try {
			setPhoto(await uploadPhoto(file));
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
					presets,
				},
			});
			navigate({ to: "/pyorat/$vehicleId", params: { vehicleId: id } });
		} catch (err) {
			toast.error(formErrorMessage(err));
			setSaving(false);
		}
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
				<div className="mt-3 grid gap-2">
					{REMINDER_PRESETS.map((p) => (
						<label key={p.key} className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								data-testid={`preset-${p.key}`}
								checked={presets.includes(p.key)}
								onChange={() => togglePreset(p.key)}
							/>
							{p.title}
							<span className="text-xs text-muted">
								{p.type === "interval"
									? [
											p.interval_km ? `${p.interval_km} km` : null,
											p.interval_months ? `${p.interval_months} kk` : null,
										]
											.filter(Boolean)
											.join(" / ")
									: "vuosittain"}
							</span>
						</label>
					))}
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
