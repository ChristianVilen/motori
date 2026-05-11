// src/components/listings/listing-form.tsx
// Shared between /ilmoitukset/uusi and /ilmoitukset/$listingId/muokkaa.
//
// Shell responsibilities:
// - Category tile selection
// - Shared fields: title, city/region/postal_code, description, images
// - Delegate category-specific fields to the per-category section adapters
// - Dispatch onSubmit to the active section's toPayload
// - On category switch: keep shared values, reset other sections' fields

import { useForm } from "@tanstack/react-form";
import { Key, Shield, ShoppingCart, Wrench, X } from "lucide-react";
import { useState } from "react";
import { CitySelect } from "~/components/listings/city-select";
import { MotorcycleFields } from "~/components/listings/sections/motorcycle-fields";
import { GearFields, gearSection } from "~/components/listings/sections/section-gear";
import { PartFields, partSection } from "~/components/listings/sections/section-part";
import { RentalFields, rentalSection } from "~/components/listings/sections/section-rental";
import { SaleFields, saleSection } from "~/components/listings/sections/section-sale";
import { FieldError, TitleField } from "~/components/listings/sections/shared-fields";
import type { SharedPayload } from "~/components/listings/sections/types";
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
import { REGIONS } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import { handleAppError } from "~/lib/errors-client";
import { useTranslation } from "~/lib/i18n";
import type { ListingFormData, ListingImageInput } from "~/lib/validators";
import { listingFormSchema } from "~/lib/validators";

interface ListingFormProps {
	lockedCategory?: ListingCategory;
	initialCategory?: ListingCategory;
	initialValues?: Partial<ListingFormData>;
	initialImages?: ListingImageInput[];
	onSubmit: (data: ListingFormData) => Promise<void>;
	submitLabel?: string;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ALL_SECTIONS = [rentalSection, saleSection, gearSection, partSection] as const;

const sectionFor: Record<ListingCategory, (typeof ALL_SECTIONS)[number]> = {
	rental: rentalSection,
	sale: saleSection,
	gear: gearSection,
	part: partSection,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: shell composes many concerns at the top level
export function ListingForm(props: ListingFormProps) {
	const { initialImages = [], initialValues, onSubmit, submitLabel } = props;
	const { t } = useTranslation("listings");
	const { t: tCommon } = useTranslation("common");

	const [category, setCategory] = useState<ListingCategory>(
		props.lockedCategory ?? props.initialCategory ?? "rental",
	);
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
			// Shared
			title: initialValues?.title ?? "",
			city: initialValues?.city ?? "",
			region: initialValues?.region ?? "",
			postal_code: initialValues?.postal_code ?? "",
			description: initialValues?.description ?? "",
			// Motorcycle fields — shared between rental & sale, owned by the shell.
			make_id: (initialValues as { make_id?: string } | undefined)?.make_id ?? "",
			model_id: (initialValues as { model_id?: string | null } | undefined)?.model_id ?? null,
			year: (initialValues as { year?: number } | undefined)?.year ?? ("" as unknown as number),
			engine_cc: (initialValues as { engine_cc?: number | null } | undefined)?.engine_cc ?? null,
			motorcycle_type:
				(initialValues as { motorcycle_type?: string } | undefined)?.motorcycle_type ?? "",
			required_license:
				(initialValues as { required_license?: "A1" | "A2" | "A" | null } | undefined)
					?.required_license ?? null,
			// Category-specific section defaults (no field name collisions).
			...rentalSection.defaultValues(initialValues),
			...saleSection.defaultValues(initialValues),
			...gearSection.defaultValues(initialValues),
			...partSection.defaultValues(initialValues),
		},
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			setUploadProgress(null);
			try {
				const newImages = await uploadFiles(pendingFiles, setUploadProgress);
				setUploadProgress(null);
				const allImages = [...existingImages, ...newImages];

				const shared: SharedPayload = {
					title: value.title,
					city: value.city,
					region: value.region,
					postal_code: value.postal_code || null,
					description: value.description,
					images: allImages,
				};

				const section = sectionFor[category];
				const moto = {
					make_id: value.make_id,
					model_id: value.model_id,
					year: value.year,
					engine_cc: value.engine_cc,
					motorcycle_type: value.motorcycle_type,
					required_license: value.required_license,
				};
				const formPayload = section.toPayload(shared, value, moto);

				const parsed = listingFormSchema(tCommon).safeParse(formPayload);
				if (!parsed.success) {
					const first = parsed.error.issues[0];
					const fieldName = first?.path[0] as string | undefined;
					if (fieldName && fieldName in value) {
						form.setFieldMeta(fieldName as never, (prev) => ({
							...prev,
							errors: [first.message],
						}));
					}
					setSubmitError(first?.message ?? t("form.submit.genericError"));
					return;
				}
				await onSubmit(parsed.data);
			} catch (err) {
				setSubmitError(null);
				const fieldError = handleAppError(err, t);
				if (fieldError) {
					setSubmitError(fieldError.message);
				}
			}
		},
	});

	function handleCategoryChange(next: ListingCategory) {
		setCategory(next);
		// Reset every other section's fields to defaults; keep shared values intact.
		for (const section of ALL_SECTIONS) {
			if (section.category === next) {
				continue;
			}
			// biome-ignore lint/suspicious/noExplicitAny: section adapters are heterogeneous
			const defaults = section.defaultValues(undefined) as Record<string, any>;
			for (const key of section.fieldKeys) {
				form.setFieldValue(key as never, defaults[key as string] as never);
			}
		}
	}

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

	const initialMakeId = (initialValues as { make_id?: string } | undefined)?.make_id ?? null;
	const initialModelId =
		(initialValues as { model_id?: string | null } | undefined)?.model_id ?? null;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
			className="space-y-8"
		>
			{!props.lockedCategory && (
				<section className="rounded-lg border border-border bg-card p-6">
					<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
						{t("form.sections.category")}
					</h2>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{(["sale", "rental", "gear", "part"] as const).map((cat) => {
							const icons: Record<string, React.ReactNode> = {
								sale: <ShoppingCart className="h-6 w-6" />,
								rental: <Key className="h-6 w-6" />,
								gear: <Shield className="h-6 w-6" />,
								part: <Wrench className="h-6 w-6" />,
							};
							return (
								<button
									key={cat}
									type="button"
									onClick={() => handleCategoryChange(cat)}
									data-testid={`category-tile-${cat}`}
									className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors ${
										category === cat
											? "border-accent bg-accent/5 text-accent"
											: "border-border bg-background text-foreground hover:border-accent/50"
									}`}
								>
									{icons[cat]}
									{t(`form.categories.${cat}`)}
								</button>
							);
						})}
					</div>
				</section>
			)}

			{/* Title for gear/part renders standalone; sale/rental render it inside MotorcycleFields */}
			{(category === "gear" || category === "part") && (
				<section className="rounded-lg border border-border bg-card p-6">
					<TitleField form={form} />
				</section>
			)}

			{(category === "sale" || category === "rental") && (
				<MotorcycleFields
					form={form}
					initialMakeId={initialMakeId}
					initialModelId={initialModelId}
				/>
			)}

			{category === "rental" && <RentalFields form={form} />}
			{category === "sale" && <SaleFields form={form} />}
			{category === "gear" && <GearFields form={form} />}
			{category === "part" && <PartFields form={form} />}

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
									<CitySelect
										id="city"
										value={field.state.value}
										placeholder={t("form.fields.cityPlaceholder")}
										onBlur={field.handleBlur}
										onChange={(city, region) => {
											field.handleChange(city);
											form.setFieldValue("region", region);
										}}
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
