import { useForm } from "@tanstack/react-form";
import { X } from "lucide-react";
import { useState } from "react";
import { CitySelect } from "~/components/listings/city-select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useTranslation } from "~/lib/i18n";
import { TORI_CATEGORIES, TORI_CONDITIONS } from "~/lib/tori/constants";
import { type ToriItemFormData, toriItemFormSchema } from "~/lib/tori/validators";

interface ToriItemFormProps {
	initialValues?: Partial<ToriItemFormData>;
	initialImages?: Array<{ url: string; thumbnail_url?: string | null }>;
	onSubmit: (data: ToriItemFormData) => Promise<void>;
	submitLabel?: string;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function FieldError({ errors }: { errors: unknown[] }) {
	const first = errors.find((e) => e != null);
	if (first == null) {
		return null;
	}
	const msg = typeof first === "string" ? first : String(first);
	return <p className="mt-1 text-sm text-destructive">{msg}</p>;
}

async function uploadFiles(
	files: File[],
	onProgress: (msg: string) => void,
): Promise<Array<{ url: string; thumbnail_url: string | null }>> {
	const results: Array<{ url: string; thumbnail_url: string | null }> = [];
	for (let i = 0; i < files.length; i++) {
		onProgress(`Ladataan kuvaa ${i + 1}/${files.length}...`);
		const body = new FormData();
		body.append("file", files[i]);
		const res = await fetch("/api/images/upload", { method: "POST", body });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: "Kuvan lataus epäonnistui" }));
			throw new Error((err as { error: string }).error);
		}
		const { url, thumbnailUrl } = (await res.json()) as { url: string; thumbnailUrl: string };
		results.push({ url, thumbnail_url: thumbnailUrl });
	}
	return results;
}

export function ToriItemForm({
	initialValues,
	initialImages = [],
	onSubmit,
	submitLabel = "Julkaise",
}: ToriItemFormProps) {
	const { t } = useTranslation("common");
	const [existingImages, setExistingImages] = useState(initialImages);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			title: initialValues?.title ?? "",
			category: initialValues?.category ?? ("" as ToriItemFormData["category"]),
			condition: initialValues?.condition ?? ("" as ToriItemFormData["condition"]),
			price: initialValues?.price ?? (0 as number),
			description: initialValues?.description ?? "",
			city: initialValues?.city ?? "",
			region: initialValues?.region ?? "",
			postal_code: initialValues?.postal_code ?? "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			try {
				let uploadedImages: Array<{ url: string; thumbnail_url: string | null }> = [];
				if (pendingFiles.length > 0) {
					uploadedImages = await uploadFiles(pendingFiles, setUploadProgress);
					setUploadProgress(null);
				}

				const allImages = [
					...existingImages.map((img) => ({
						url: img.url,
						thumbnail_url: img.thumbnail_url ?? null,
					})),
					...uploadedImages,
				];

				const data = toriItemFormSchema.parse({
					...value,
					price: Number(value.price),
					postal_code: value.postal_code || null,
					images: allImages,
				});

				await onSubmit(data);
			} catch (err) {
				setUploadProgress(null);
				setSubmitError(err instanceof Error ? err.message : "Jotain meni pieleen.");
			}
		},
	});

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []);
		setImageError(null);

		const totalCount = existingImages.length + pendingFiles.length + files.length;
		if (totalCount > MAX_IMAGES) {
			setImageError(`Enintään ${MAX_IMAGES} kuvaa.`);
			return;
		}

		for (const file of files) {
			if (!ALLOWED_TYPES.includes(file.type)) {
				setImageError("Sallitut tiedostotyypit: JPEG, PNG, WebP.");
				return;
			}
			if (file.size > MAX_FILE_SIZE) {
				setImageError("Kuva saa olla enintään 5 MB.");
				return;
			}
		}

		setPendingFiles((prev) => [...prev, ...files]);
		const newPreviews = files.map((f) => URL.createObjectURL(f));
		setImagePreviews((prev) => [...prev, ...newPreviews]);
		e.target.value = "";
	}

	function removeExistingImage(idx: number) {
		setExistingImages((prev) => prev.filter((_, i) => i !== idx));
	}

	function removePendingImage(idx: number) {
		URL.revokeObjectURL(imagePreviews[idx]);
		setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
		setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			{/* Title */}
			<form.Field name="title">
				{(field) => (
					<div>
						<label htmlFor="title" className="block text-sm font-medium text-foreground">
							Otsikko
						</label>
						<Input
							id="title"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							placeholder="Esim. Alpinestars GP Plus -nahkatakki"
							className="mt-1"
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			{/* Category + Condition row */}
			<div className="grid grid-cols-2 gap-4">
				<form.Field name="category">
					{(field) => (
						<div>
							<label htmlFor="category" className="block text-sm font-medium text-foreground">
								Kategoria
							</label>
							<select
								id="category"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value as ToriItemFormData["category"])}
								onBlur={field.handleBlur}
								className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
							>
								<option value="">Valitse...</option>
								{TORI_CATEGORIES.map((c) => (
									<option key={c.value} value={c.value}>
										{t(c.labelKey)}
									</option>
								))}
							</select>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>

				<form.Field name="condition">
					{(field) => (
						<div>
							<label htmlFor="condition" className="block text-sm font-medium text-foreground">
								Kunto
							</label>
							<select
								id="condition"
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as ToriItemFormData["condition"])
								}
								onBlur={field.handleBlur}
								className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
							>
								<option value="">Valitse...</option>
								{TORI_CONDITIONS.map((c) => (
									<option key={c.value} value={c.value}>
										{t(c.labelKey)}
									</option>
								))}
							</select>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
			</div>

			{/* Price */}
			<form.Field name="price">
				{(field) => (
					<div>
						<label htmlFor="price" className="block text-sm font-medium text-foreground">
							Hinta (€)
						</label>
						<Input
							id="price"
							type="number"
							min={0}
							step={1}
							value={field.state.value || ""}
							onChange={(e) => field.handleChange(Number(e.target.value))}
							onBlur={field.handleBlur}
							placeholder="0"
							className="mt-1"
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			{/* Description */}
			<form.Field name="description">
				{(field) => (
					<div>
						<label htmlFor="description" className="block text-sm font-medium text-foreground">
							Kuvaus
						</label>
						<Textarea
							id="description"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							rows={5}
							placeholder="Kerro tuotteesta tarkemmin..."
							className="mt-1"
						/>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			{/* City */}
			<form.Field name="city">
				{(field) => (
					<div>
						<label htmlFor="city" className="block text-sm font-medium text-foreground">
							Paikkakunta
						</label>
						<div className="mt-1">
							<CitySelect
								id="city"
								value={field.state.value}
								onChange={(city, region) => {
									field.handleChange(city);
									form.setFieldValue("region", region);
								}}
								onBlur={field.handleBlur}
								placeholder="Valitse paikkakunta..."
							/>
						</div>
						<FieldError errors={field.state.meta.errors} />
					</div>
				)}
			</form.Field>

			{/* Images */}
			<div>
				<label htmlFor="images" className="block text-sm font-medium text-foreground">
					Kuvat
				</label>
				<div className="mt-2 flex flex-wrap gap-2">
					{existingImages.map((img, i) => (
						<div key={img.url} className="relative h-20 w-20 overflow-hidden rounded-lg border">
							<img
								src={img.thumbnail_url ?? img.url}
								alt=""
								className="h-full w-full object-cover"
							/>
							<button
								type="button"
								onClick={() => removeExistingImage(i)}
								className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
								aria-label="Poista kuva"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
					{imagePreviews.map((src, i) => (
						<div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border">
							<img src={src} alt="" className="h-full w-full object-cover" />
							<button
								type="button"
								onClick={() => removePendingImage(i)}
								className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
								aria-label="Poista kuva"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
					{existingImages.length + pendingFiles.length < MAX_IMAGES && (
						<label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted hover:border-accent hover:text-accent">
							<span className="text-2xl">+</span>
							<input
								type="file"
								id="images"
								accept="image/jpeg,image/png,image/webp"
								multiple
								onChange={handleFileSelect}
								className="hidden"
							/>
						</label>
					)}
				</div>
				{!!imageError && <p className="mt-1 text-sm text-destructive">{imageError}</p>}
			</div>

			{/* Submit */}
			{!!submitError && (
				<p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{submitError}
				</p>
			)}
			{!!uploadProgress && <p className="text-sm text-muted">{uploadProgress}</p>}

			<Button
				type="submit"
				disabled={form.state.isSubmitting}
				className="w-full"
				data-testid="tori-form-submit"
			>
				{form.state.isSubmitting === true ? "Tallennetaan..." : (submitLabel ?? "Julkaise")}
			</Button>
		</form>
	);
}
