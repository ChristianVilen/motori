// src/components/listings/listing-form.tsx
// Shared between /ilmoitukset/uusi and /ilmoitukset/$listingId/muokkaa
import { useForm } from "@tanstack/react-form";
import { X } from "lucide-react";
import { useState } from "react";
import { MakeModelSelect } from "~/components/listings/make-model-select";
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
import { CURRENT_YEAR, LICENSE_CLASSES, MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { ListingFormData, ListingImageInput } from "~/lib/validators";
import { listingFormSchema } from "~/lib/validators";

interface ListingFormProps {
	initialValues?: Partial<ListingFormData>;
	initialImages?: ListingImageInput[];
	onSubmit: (data: ListingFormData) => Promise<void>;
	submitLabel?: string;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function FieldError({ errors }: { errors: unknown[] }) {
	const first = errors.find((e) => e != null);
	if (first == null) {
		return null;
	}
	const msg = typeof first === "string" ? first : String(first);
	return <p className="mt-1 text-sm text-destructive">{msg}</p>;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large form with many fields
export function ListingForm({
	initialValues,
	initialImages = [],
	onSubmit,
	submitLabel,
}: ListingFormProps) {
	const { t } = useTranslation("listings");
	const { t: tCommon } = useTranslation("common");

	const [existingImages, setExistingImages] = useState<ListingImageInput[]>(initialImages);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);
	const [imagePreviews, setImagePreviews] = useState<string[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [uploadProgress, setUploadProgress] = useState<string | null>(null);

	async function uploadFiles(
		files: File[],
		onProgress: (msg: string) => void,
	): Promise<{ url: string; thumbnail_url: string | null }[]> {
		const results: { url: string; thumbnail_url: string | null }[] = [];
		for (let i = 0; i < files.length; i++) {
			onProgress(t("form.images.uploading", { current: i + 1, total: files.length }));
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

	const form = useForm({
		defaultValues: {
			title: initialValues?.title ?? "",
			make_id: initialValues?.make_id ?? "",
			model_id: initialValues?.model_id ?? null,
			// "" lets the controlled input start empty; the form validates before submit
			year: initialValues?.year ?? ("" as unknown as number),
			engine_cc: initialValues?.engine_cc ?? null,
			motorcycle_type: initialValues?.motorcycle_type ?? "",
			required_license: initialValues?.required_license ?? null,
			price_per_day: initialValues?.price_per_day ?? ("" as unknown as number), // same as year
			price_per_week: initialValues?.price_per_week ?? null,
			price_description: initialValues?.price_description ?? "",
			city: initialValues?.city ?? "",
			region: initialValues?.region ?? "",
			postal_code: initialValues?.postal_code ?? "",
			description: initialValues?.description ?? "",
			mileage_limit: initialValues?.mileage_limit ?? null,
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			setUploadProgress(null);
			try {
				const newImages = await uploadFiles(pendingFiles, setUploadProgress);
				setUploadProgress(null);
				const allImages = [...existingImages, ...newImages];
				const parsed = listingFormSchema(tCommon).safeParse({ ...value, images: allImages });
				if (!parsed.success) {
					const first = parsed.error.issues[0];
					const fieldName = first?.path[0] as keyof typeof value | undefined;
					if (fieldName && fieldName in value) {
						form.setFieldMeta(fieldName, (prev) => ({
							...prev,
							errors: [first.message],
						}));
					}
					setSubmitError(first?.message ?? t("form.submit.genericError"));
					return;
				}
				await onSubmit(parsed.data);
			} catch (err) {
				setSubmitError(err instanceof Error ? err.message : t("form.submit.genericError"));
			}
		},
	});

	function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
		setImageError(null);
		const files = Array.from(e.target.files ?? []);
		const remaining = MAX_IMAGES - existingImages.length;
		const valid: File[] = [];
		for (const file of files) {
			if (valid.length >= remaining) {
				break;
			}
			if (!ALLOWED_TYPES.includes(file.type)) {
				setImageError(t("form.images.errorInvalidType"));
				continue;
			}
			if (file.size > MAX_FILE_SIZE) {
				setImageError(t("form.images.errorFileTooLarge"));
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
		setExistingImages((prev) => prev.filter((img) => img.url !== url));
	}

	function removePendingImage(index: number) {
		setPendingFiles((prev) => prev.filter((_, i) => i !== index));
		setImagePreviews((prev) => prev.filter((_, i) => i !== index));
	}

	const totalImages = existingImages.length + pendingFiles.length;
	const canAddMore = totalImages < MAX_IMAGES;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-8"
		>
			{/* ── Moottoripyörä ─────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					{t("form.sections.motorcycle")}
				</h2>
				<div className="space-y-4">
					<form.Field name="title">
						{(field) => (
							<div>
								<label htmlFor="title" className="mb-1 block text-sm font-medium text-foreground">
									{t("form.fields.title")} <span className="text-destructive">*</span>
								</label>
								<Input
									id="title"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<p className="mt-1 text-xs text-muted">{t("form.fields.titleHint")}</p>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>

					<form.Field name="make_id">
						{(makeField) => (
							<MakeModelSelect
								initialMakeId={initialValues?.make_id ?? null}
								initialModelId={initialValues?.model_id ?? null}
								onMakeChange={(id) => makeField.handleChange(id)}
								onModelChange={(id) => form.setFieldValue("model_id", id)}
								makeError={makeField.state.meta.errors[0]}
							/>
						)}
					</form.Field>

					<div className="grid grid-cols-2 gap-4">
						<form.Field name="year">
							{(field) => (
								<div>
									<label htmlFor="year" className="mb-1 block text-sm font-medium text-foreground">
										{t("form.fields.year")} <span className="text-destructive">*</span>
									</label>
									<Input
										id="year"
										type="number"
										min={1970}
										max={CURRENT_YEAR + 1}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber,
											)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
						<form.Field name="engine_cc">
							{(field) => (
								<div>
									<label
										htmlFor="engine_cc"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.engineCc")}
									</label>
									<Input
										id="engine_cc"
										type="number"
										min={50}
										max={3000}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<form.Field name="motorcycle_type">
							{(field) => (
								<div>
									<label
										htmlFor="motorcycle_type"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.type")} <span className="text-destructive">*</span>
									</label>
									<Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
										<SelectTrigger id="motorcycle_type">
											<SelectValue placeholder={t("form.fields.typePlaceholder")} />
										</SelectTrigger>
										<SelectContent>
											{MOTORCYCLE_TYPES.map((mt) => (
												<SelectItem key={mt.value} value={mt.value}>
													{mt.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
						<form.Field name="required_license">
							{(field) => (
								<div>
									<span className="mb-1 block text-sm font-medium text-foreground">
										{t("form.fields.requiredLicense")}
									</span>
									<div className="flex gap-2">
										{LICENSE_CLASSES.map((cls) => (
											<button
												key={cls.value}
												type="button"
												title={cls.description}
												onClick={() =>
													field.handleChange(field.state.value === cls.value ? null : cls.value)
												}
												className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
													field.state.value === cls.value
														? "border-accent bg-accent text-white"
														: "border-border bg-background text-foreground hover:bg-muted-light"
												}`}
											>
												{cls.label}
											</button>
										))}
									</div>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
					</div>
				</div>
			</section>

			{/* ── Hinta ─────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					{t("form.sections.price")}
				</h2>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<form.Field name="price_per_day">
							{(field) => (
								<div>
									<label
										htmlFor="price_per_day"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.pricePerDay")} <span className="text-destructive">*</span>
									</label>
									<Input
										id="price_per_day"
										type="number"
										min={1}
										max={10000}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber,
											)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
						<form.Field name="price_per_week">
							{(field) => (
								<div>
									<label
										htmlFor="price_per_week"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.pricePerWeek")}
									</label>
									<Input
										id="price_per_week"
										type="number"
										min={1}
										max={50000}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
					</div>

					<form.Field name="price_description">
						{(field) => (
							<div>
								<label
									htmlFor="price_description"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.priceDescription")}
								</label>
								<Input
									id="price_description"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
					<form.Field name="mileage_limit">
						{(field) => (
							<div className="w-1/3">
								<label
									htmlFor="mileage_limit"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.mileageLimit")}
								</label>
								<Input
									id="mileage_limit"
									type="number"
									min={0}
									max={10000}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
									}
								/>
								<p className="mt-1 text-xs text-muted">{t("form.fields.mileageLimitHint")}</p>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>
			</section>

			{/* ── Sijainti ──────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					{t("form.sections.location")}
				</h2>
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<form.Field name="city">
							{(field) => (
								<div>
									<label htmlFor="city" className="mb-1 block text-sm font-medium text-foreground">
										{t("form.fields.city")} <span className="text-destructive">*</span>
									</label>
									<Input
										id="city"
										autoComplete="address-level2"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
						<form.Field name="region">
							{(field) => (
								<div>
									<label
										htmlFor="region"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.region")} <span className="text-destructive">*</span>
									</label>
									<Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
										<SelectTrigger id="region">
											<SelectValue placeholder={t("form.fields.regionPlaceholder")} />
										</SelectTrigger>
										<SelectContent>
											{REGIONS.map((r) => (
												<SelectItem key={r.value} value={r.value}>
													{r.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
					</div>
					<form.Field name="postal_code">
						{(field) => (
							<div className="w-1/2 pr-2">
								<label
									htmlFor="postal_code"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.postalCode")}
								</label>
								<Input
									id="postal_code"
									autoComplete="postal-code"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									maxLength={10}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>
			</section>

			{/* ── Kuvaus ────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					{t("form.sections.description")}
				</h2>
				<form.Field name="description">
					{(field) => (
						<div>
							<label
								htmlFor="description"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								{t("form.fields.description")} <span className="text-destructive">*</span>
							</label>
							<Textarea
								id="description"
								rows={6}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className="resize-y"
							/>
							<p className="mt-1 text-xs text-muted">
								{t("form.fields.descriptionCharCount", { n: field.state.value.length })} ·{" "}
								{t("form.fields.descriptionMinHint")}
							</p>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
			</section>

			{/* ── Kuvat ─────────────────────────────────────────────────────── */}
			<section className="rounded-lg border border-border bg-card p-6">
				<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
					{t("form.sections.images")}{" "}
					<span className="font-normal text-muted">
						({totalImages}/{MAX_IMAGES})
					</span>
				</h2>

				{(existingImages.length > 0 || imagePreviews.length > 0) && (
					<div className="mb-4 grid grid-cols-4 gap-2">
						{existingImages.map((img) => (
							<div
								key={img.url}
								className="group relative aspect-square overflow-hidden rounded-md bg-muted-light"
							>
								<img src={img.url} alt="" className="h-full w-full object-cover" />
								<button
									type="button"
									onClick={() => removeExistingImage(img.url)}
									className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
									aria-label={t("form.images.removeImageAriaLabel")}
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
						{imagePreviews.map((preview, i) => (
							<div
								key={`${pendingFiles[i]?.name ?? i}-${pendingFiles[i]?.size ?? i}`}
								className="group relative aspect-square overflow-hidden rounded-md bg-muted-light"
							>
								<img src={preview} alt="" className="h-full w-full object-cover" />
								<button
									type="button"
									onClick={() => removePendingImage(i)}
									className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
									aria-label={t("form.images.removeImageAriaLabel")}
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
							{t("form.images.addImages")}{" "}
							<span className="text-accent">{t("form.images.dragHere")}</span>
						</span>
						<span className="text-xs text-muted">{t("form.images.fileConstraints")}</span>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp"
							multiple
							onChange={handleFileSelect}
							className="sr-only"
							aria-label={t("form.images.addImages")}
						/>
					</label>
				)}

				{!!imageError && <p className="mt-2 text-sm text-destructive">{imageError}</p>}
			</section>

			{/* ── Submit ────────────────────────────────────────────────────── */}
			{!!submitError && (
				<div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{submitError}
				</div>
			)}

			<form.Subscribe selector={(s) => s.isSubmitting}>
				{(isSubmitting) => (
					<Button
						type="submit"
						disabled={isSubmitting}
						className="w-full bg-accent text-white hover:bg-accent-hover"
						size="lg"
						data-testid="listing-form-submit"
					>
						{uploadProgress ??
							(isSubmitting ? t("form.submit.saving") : (submitLabel ?? t("create.submitLabel")))}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
