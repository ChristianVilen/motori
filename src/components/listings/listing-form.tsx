// src/components/listings/listing-form.tsx
// Shared between /listings/new and /listings/$listingId/edit
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
	CURRENT_YEAR,
	LICENSE_CLASSES,
	MOTORCYCLE_BRANDS,
	MOTORCYCLE_TYPES,
	REGIONS,
} from "~/lib/constants";
import { getImageUploadUrl } from "~/lib/storage";
import type { ListingFormData } from "~/lib/validators";

export interface ListingFormValues {
	title: string;
	brand: string;
	model: string;
	year: number;
	engine_cc: number | null;
	motorcycle_type: string;
	required_license: "A1" | "A2" | "A" | null;
	price_per_day: number;
	price_per_week: number | null;
	deposit_amount: number | null;
	price_description: string;
	city: string;
	region: string;
	postal_code: string;
	available_from: string;
	available_to: string;
	season_only: boolean;
	description: string;
	includes_helmet: boolean;
	includes_insurance: boolean;
	insurance_info: string;
	mileage_limit: number | null;
}

interface ListingFormProps {
	initialValues?: Partial<ListingFormValues>;
	initialImageUrls?: string[];
	onSubmit: (data: ListingFormData) => Promise<void>;
	submitLabel?: string;
}

function toNum(s: string): number | null {
	const n = Number(s);
	return s === "" || Number.isNaN(n) ? null : n;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ListingForm({
	initialValues,
	initialImageUrls = [],
	onSubmit,
	submitLabel = "Julkaise ilmoitus",
}: ListingFormProps) {
	const [title, setTitle] = useState(initialValues?.title ?? "");
	const [brand, setBrand] = useState(initialValues?.brand ?? "");
	const [model, setModel] = useState(initialValues?.model ?? "");
	const [year, setYear] = useState(String(initialValues?.year ?? CURRENT_YEAR));
	const [engineCc, setEngineCc] = useState(String(initialValues?.engine_cc ?? ""));
	const [motorcycleType, setMotorcycleType] = useState(initialValues?.motorcycle_type ?? "");
	const [requiredLicense, setRequiredLicense] = useState<"A1" | "A2" | "A" | null>(
		initialValues?.required_license ?? null,
	);
	const [pricePerDay, setPricePerDay] = useState(String(initialValues?.price_per_day ?? ""));
	const [pricePerWeek, setPricePerWeek] = useState(String(initialValues?.price_per_week ?? ""));
	const [depositAmount, setDepositAmount] = useState(String(initialValues?.deposit_amount ?? ""));
	const [priceDescription, setPriceDescription] = useState(initialValues?.price_description ?? "");
	const [city, setCity] = useState(initialValues?.city ?? "");
	const [region, setRegion] = useState(initialValues?.region ?? "");
	const [postalCode, setPostalCode] = useState(initialValues?.postal_code ?? "");
	const [availableFrom, setAvailableFrom] = useState(initialValues?.available_from ?? "");
	const [availableTo, setAvailableTo] = useState(initialValues?.available_to ?? "");
	const [seasonOnly, setSeasonOnly] = useState(initialValues?.season_only ?? false);
	const [description, setDescription] = useState(initialValues?.description ?? "");
	const [includesHelmet, setIncludesHelmet] = useState(initialValues?.includes_helmet ?? false);
	const [includesInsurance, setIncludesInsurance] = useState(
		initialValues?.includes_insurance ?? false,
	);
	const [insuranceInfo, setInsuranceInfo] = useState(initialValues?.insurance_info ?? "");
	const [mileageLimit, setMileageLimit] = useState(String(initialValues?.mileage_limit ?? ""));

	const [imageUrls, setImageUrls] = useState<string[]>(initialImageUrls);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		setImageError(null);
		const files = Array.from(e.target.files ?? []);
		const remaining = MAX_IMAGES - imageUrls.length;

		const valid: File[] = [];
		for (const file of files) {
			if (valid.length >= remaining) break;
			if (!ALLOWED_TYPES.includes(file.type)) {
				setImageError("Vain JPEG, PNG ja WebP tiedostot ovat sallittuja");
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				setImageError("Kuvan maksimikoko on 5 MB");
				continue;
			}
			valid.push(file);
		}

		setPendingFiles((prev) => [...prev, ...valid]);
		for (const file of valid) {
			const reader = new FileReader();
			reader.onload = (ev) => {
				setImagePreviews((prev) => [...prev, ev.target?.result as string]);
			};
			reader.readAsDataURL(file);
		}
		e.target.value = "";
	}

	function removeExistingImage(url: string) {
		setImageUrls((prev) => prev.filter((u) => u !== url));
	}

	function removePendingImage(index: number) {
		setPendingFiles((prev) => prev.filter((_, i) => i !== index));
		setImagePreviews((prev) => prev.filter((_, i) => i !== index));
	}

	async function uploadPendingFiles(): Promise<string[]> {
		const uploaded: string[] = [];
		for (const file of pendingFiles) {
			const { uploadUrl, publicUrl } = await getImageUploadUrl({
				data: { filename: file.name, contentType: file.type },
			});
			await fetch(uploadUrl, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});
			uploaded.push(publicUrl);
		}
		return uploaded;
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			let newImageUrls: string[] = [];
			if (pendingFiles.length > 0) {
				newImageUrls = await uploadPendingFiles();
			}

			const allImageUrls = [...imageUrls, ...newImageUrls];

			await onSubmit({
				title: title.trim(),
				brand,
				model: model.trim(),
				year: Number(year),
				engine_cc: toNum(engineCc),
				motorcycle_type: motorcycleType,
				required_license: requiredLicense,
				price_per_day: Number(pricePerDay),
				price_per_week: toNum(pricePerWeek),
				deposit_amount: toNum(depositAmount),
				price_description: priceDescription.trim() || null,
				city: city.trim(),
				region,
				postal_code: postalCode.trim() || null,
				available_from: availableFrom || null,
				available_to: availableTo || null,
				season_only: seasonOnly,
				description: description.trim(),
				includes_helmet: includesHelmet,
				includes_insurance: includesInsurance,
				insurance_info: insuranceInfo.trim() || null,
				mileage_limit: toNum(mileageLimit),
				image_urls: allImageUrls,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Jokin meni pieleen. Yritä uudelleen.");
		} finally {
			setLoading(false);
		}
	}

	const totalImages = imageUrls.length + pendingFiles.length;
	const canAddMore = totalImages < MAX_IMAGES;

	return (
		<form onSubmit={handleSubmit} className="space-y-8">
			{/* ── Moottoripyörä ─────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					Moottoripyörä
				</h2>
				<div className="space-y-4">
					<div>
						<label htmlFor="title" className="mb-1 block text-sm font-medium text-foreground">
							Otsikko <span className="text-destructive">*</span>
						</label>
						<Input
							id="title"
							required
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Honda CB500F 2020 — siisti vuosimalli"
						/>
						<p className="mt-1 text-xs text-muted">Kuvaava otsikko houkuttelee enemmän yhteydenottoja</p>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label htmlFor="brand" className="mb-1 block text-sm font-medium text-foreground">
								Merkki <span className="text-destructive">*</span>
							</label>
							<Select value={brand} onValueChange={setBrand} required>
								<SelectTrigger id="brand">
									<SelectValue placeholder="Valitse merkki" />
								</SelectTrigger>
								<SelectContent>
									{MOTORCYCLE_BRANDS.map((b) => (
										<SelectItem key={b} value={b}>
											{b}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label htmlFor="model" className="mb-1 block text-sm font-medium text-foreground">
								Malli <span className="text-destructive">*</span>
							</label>
							<Input
								id="model"
								required
								value={model}
								onChange={(e) => setModel(e.target.value)}
								placeholder="CB500F"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label htmlFor="year" className="mb-1 block text-sm font-medium text-foreground">
								Vuosimalli <span className="text-destructive">*</span>
							</label>
							<Input
								id="year"
								type="number"
								required
								min={1970}
								max={CURRENT_YEAR + 1}
								value={year}
								onChange={(e) => setYear(e.target.value)}
							/>
						</div>
						<div>
							<label htmlFor="engine_cc" className="mb-1 block text-sm font-medium text-foreground">
								Moottorin tilavuus (cc)
							</label>
							<Input
								id="engine_cc"
								type="number"
								min={50}
								max={3000}
								value={engineCc}
								onChange={(e) => setEngineCc(e.target.value)}
								placeholder="500"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="motorcycle_type"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Tyyppi <span className="text-destructive">*</span>
							</label>
							<Select value={motorcycleType} onValueChange={setMotorcycleType} required>
								<SelectTrigger id="motorcycle_type">
									<SelectValue placeholder="Valitse tyyppi" />
								</SelectTrigger>
								<SelectContent>
									{MOTORCYCLE_TYPES.map((t) => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<span className="mb-1 block text-sm font-medium text-foreground">
								Vaadittu ajokortti
							</span>
							<div className="flex gap-2">
								{LICENSE_CLASSES.map((cls) => (
									<button
										key={cls.value}
										type="button"
										title={cls.description}
										onClick={() =>
											setRequiredLicense(requiredLicense === cls.value ? null : cls.value)
										}
										className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
											requiredLicense === cls.value
												? "border-accent bg-accent text-white"
												: "border-border bg-background text-foreground hover:bg-muted-light"
										}`}
									>
										{cls.label}
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── Hinta ─────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Hinta</h2>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="price_per_day"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Päivähinta (€) <span className="text-destructive">*</span>
							</label>
							<Input
								id="price_per_day"
								type="number"
								required
								min={1}
								max={10000}
								value={pricePerDay}
								onChange={(e) => setPricePerDay(e.target.value)}
								placeholder="50"
							/>
						</div>
						<div>
							<label
								htmlFor="price_per_week"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Viikkohinta (€)
							</label>
							<Input
								id="price_per_week"
								type="number"
								min={1}
								max={50000}
								value={pricePerWeek}
								onChange={(e) => setPricePerWeek(e.target.value)}
								placeholder="280"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="deposit_amount"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Vakuus (€)
							</label>
							<Input
								id="deposit_amount"
								type="number"
								min={0}
								max={100000}
								value={depositAmount}
								onChange={(e) => setDepositAmount(e.target.value)}
								placeholder="500"
							/>
						</div>
						<div>
							<label
								htmlFor="price_description"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Lisätietoja hinnasta
							</label>
							<Input
								id="price_description"
								value={priceDescription}
								onChange={(e) => setPriceDescription(e.target.value)}
								placeholder="Kausihinnoittelu mahdollinen"
							/>
						</div>
					</div>
				</div>
			</section>

			{/* ── Sijainti ──────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Sijainti</h2>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label htmlFor="city" className="mb-1 block text-sm font-medium text-foreground">
								Kaupunki <span className="text-destructive">*</span>
							</label>
							<Input
								id="city"
								required
								value={city}
								onChange={(e) => setCity(e.target.value)}
								placeholder="Helsinki"
							/>
						</div>
						<div>
							<label htmlFor="region" className="mb-1 block text-sm font-medium text-foreground">
								Maakunta <span className="text-destructive">*</span>
							</label>
							<Select value={region} onValueChange={setRegion} required>
								<SelectTrigger id="region">
									<SelectValue placeholder="Valitse maakunta" />
								</SelectTrigger>
								<SelectContent>
									{REGIONS.map((r) => (
										<SelectItem key={r.value} value={r.value}>
											{r.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="w-1/2 pr-2">
						<label
							htmlFor="postal_code"
							className="mb-1 block text-sm font-medium text-foreground"
						>
							Postinumero
						</label>
						<Input
							id="postal_code"
							value={postalCode}
							onChange={(e) => setPostalCode(e.target.value)}
							placeholder="00100"
							maxLength={10}
						/>
					</div>
				</div>
			</section>

			{/* ── Saatavuus ─────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					Saatavuus
				</h2>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="available_from"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Saatavilla alkaen
							</label>
							<Input
								id="available_from"
								type="date"
								value={availableFrom}
								onChange={(e) => setAvailableFrom(e.target.value)}
							/>
						</div>
						<div>
							<label
								htmlFor="available_to"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Saatavilla asti
							</label>
							<Input
								id="available_to"
								type="date"
								value={availableTo}
								onChange={(e) => setAvailableTo(e.target.value)}
							/>
						</div>
					</div>
					<label className="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={seasonOnly}
							onChange={(e) => setSeasonOnly(e.target.checked)}
							className="h-4 w-4 rounded border-border accent-accent"
						/>
						<span className="text-sm text-foreground">Vain ajokaudella (huhti–lokakuu)</span>
					</label>
				</div>
			</section>

			{/* ── Kuvaus ────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Kuvaus</h2>
				<div>
					<label htmlFor="description" className="mb-1 block text-sm font-medium text-foreground">
						Kuvaus <span className="text-destructive">*</span>
					</label>
					<Textarea
						id="description"
						required
						rows={6}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Kerro pyörästä, sen kunnosta, varusteluista ja vuokrauskäytännöistäsi..."
						className="resize-y"
					/>
					<p className="mt-1 text-xs text-muted">{description.length}/5000 merkkiä</p>
				</div>
			</section>

			{/* ── Varusteet & vakuutus ──────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					Varusteet & vakuutus
				</h2>
				<div className="space-y-3">
					<label className="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={includesHelmet}
							onChange={(e) => setIncludesHelmet(e.target.checked)}
							className="h-4 w-4 rounded border-border accent-accent"
						/>
						<span className="text-sm text-foreground">Kypärä sisältyy hintaan</span>
					</label>
					<label className="flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={includesInsurance}
							onChange={(e) => setIncludesInsurance(e.target.checked)}
							className="h-4 w-4 rounded border-border accent-accent"
						/>
						<span className="text-sm text-foreground">Vakuutus sisältyy hintaan</span>
					</label>
					{includesInsurance && (
						<div className="ml-7">
							<Input
								value={insuranceInfo}
								onChange={(e) => setInsuranceInfo(e.target.value)}
								placeholder="Vakuutusyhtiö ja vakuutuksen tiedot"
							/>
						</div>
					)}
					<div className="pt-1">
						<label
							htmlFor="mileage_limit"
							className="mb-1 block text-sm font-medium text-foreground"
						>
							Kilometriraja (km/pv)
						</label>
						<div className="w-1/3">
							<Input
								id="mileage_limit"
								type="number"
								min={0}
								max={10000}
								value={mileageLimit}
								onChange={(e) => setMileageLimit(e.target.value)}
								placeholder="200"
							/>
						</div>
						<p className="mt-1 text-xs text-muted">Jätä tyhjäksi jos ei kilometrirajoitusta</p>
					</div>
				</div>
			</section>

			{/* ── Kuvat ─────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					Kuvat{" "}
					<span className="font-normal text-muted">
						({totalImages}/{MAX_IMAGES})
					</span>
				</h2>

				{/* Existing uploaded images */}
				{(imageUrls.length > 0 || imagePreviews.length > 0) && (
					<div className="mb-4 grid grid-cols-4 gap-2">
						{imageUrls.map((url) => (
							<div key={url} className="group relative aspect-square overflow-hidden rounded-md bg-muted-light">
								<img src={url} alt="" className="h-full w-full object-cover" />
								<button
									type="button"
									onClick={() => removeExistingImage(url)}
									className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
									aria-label="Poista kuva"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
						{imagePreviews.map((preview, i) => (
							<div
								key={`preview-${i}`}
								className="group relative aspect-square overflow-hidden rounded-md bg-muted-light"
							>
								<img src={preview} alt="" className="h-full w-full object-cover" />
								<div className="absolute inset-0 flex items-center justify-center bg-black/20">
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
								</div>
								<button
									type="button"
									onClick={() => removePendingImage(i)}
									className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
									aria-label="Poista kuva"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
					</div>
				)}

				{canAddMore && (
					<label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-accent hover:bg-muted-light/50">
						<svg
							className="h-8 w-8 text-muted"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
							/>
						</svg>
						<span className="text-sm text-muted">
							Lisää kuvia <span className="text-accent">tai vedä tähän</span>
						</span>
						<span className="text-xs text-muted">JPEG, PNG tai WebP · max 5 MB per kuva</span>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							onChange={handleFileSelect}
							className="sr-only"
						/>
					</label>
				)}

				{imageError && <p className="mt-2 text-sm text-destructive">{imageError}</p>}
			</section>

			{/* ── Submit ────────────────────────────────────────────────────── */}
			{error && (
				<div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			)}

			<Button
				type="submit"
				disabled={loading}
				className="w-full bg-accent text-white hover:bg-accent-hover"
				size="lg"
			>
				{loading ? "Tallennetaan..." : submitLabel}
			</Button>
		</form>
	);
}
