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
import {
	ChevronLeft,
	ChevronRight,
	Key,
	Shield,
	ShoppingCart,
	Star,
	Wrench,
	X,
} from "lucide-react";
import { useState } from "react";
import { CitySelect } from "~/components/listings/city-select";
import { MotorcycleFields } from "~/components/listings/sections/motorcycle-fields";
import { GearFields, gearSection } from "~/components/listings/sections/section-gear";
import { PartFields, partSection } from "~/components/listings/sections/section-part";
import { RentalFields, rentalSection } from "~/components/listings/sections/section-rental";
import { SaleFields, saleSection } from "~/components/listings/sections/section-sale";
import { FieldError, TitleField } from "~/components/listings/sections/shared-fields";
import type { SharedPayload } from "~/components/listings/sections/types";
import { useImageUpload } from "~/components/listings/use-image-upload";
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
import type { ListingFormData } from "~/lib/validators";
import { listingFormSchema } from "~/lib/validators";

interface ListingFormProps {
	lockedCategory?: ListingCategory;
	initialCategory?: ListingCategory;
	initialValues?: Partial<ListingFormData>;
	initialImages?: { url: string; thumbnail_url?: string | null }[];
	onSubmit: (data: ListingFormData) => Promise<void>;
	submitLabel?: string;
}

const ALL_SECTIONS = [rentalSection, saleSection, gearSection, partSection] as const;

const sectionFor: Record<ListingCategory, (typeof ALL_SECTIONS)[number]> = {
	rental: rentalSection,
	sale: saleSection,
	gear: gearSection,
	part: partSection,
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form shell — remaining complexity is conditional JSX rendering per category
export function ListingForm(props: ListingFormProps) {
	const { initialImages = [], initialValues, onSubmit, submitLabel } = props;
	const { t } = useTranslation("listings");
	const { t: tCommon } = useTranslation("common");

	const [category, setCategory] = useState<ListingCategory>(
		props.lockedCategory ?? props.initialCategory ?? "sale",
	);
	const images = useImageUpload(initialImages);
	const [submitError, setSubmitError] = useState<string | null>(null);

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
			try {
				const allImages = await images.uploadFiles();

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
						({images.totalImages}/{images.maxImages})
					</span>
				</h2>

				{images.items.length > 0 && (
					<p className="mb-2 text-xs text-muted">{t("form.images.coverHint")}</p>
				)}
				{images.items.length > 0 && (
					<div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
						{images.items.map((item, i) => {
							const src = item.kind === "existing" ? item.url : item.preview;
							const isCover = i === 0;
							const isLast = i === images.items.length - 1;
							return (
								<div
									key={item.key}
									className={`relative aspect-square overflow-hidden rounded-md bg-muted-light ${isCover ? "ring-2 ring-accent" : ""}`}
								>
									<img src={src} alt="" className="h-full w-full object-cover" />
									{isCover && (
										<span className="absolute left-1 top-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
											{t("form.images.coverBadge")}
										</span>
									)}
									<button
										type="button"
										onClick={() => images.removeItem(item.key)}
										className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
										aria-label={t("form.images.removeImageAriaLabel")}
									>
										<X className="h-3 w-3" />
									</button>
									<div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
										<button
											type="button"
											onClick={() => images.moveItem(item.key, -1)}
											disabled={isCover}
											className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
											aria-label={t("form.images.moveLeftAriaLabel")}
										>
											<ChevronLeft className="h-3 w-3" />
										</button>
										{!isCover && (
											<button
												type="button"
												onClick={() => images.setAsCover(item.key)}
												className="rounded-full bg-black/60 p-1 text-white"
												aria-label={t("form.images.setCoverAriaLabel")}
											>
												<Star className="h-3 w-3" />
											</button>
										)}
										<button
											type="button"
											onClick={() => images.moveItem(item.key, 1)}
											disabled={isLast}
											className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
											aria-label={t("form.images.moveRightAriaLabel")}
										>
											<ChevronRight className="h-3 w-3" />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{images.canAddMore ? (
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
							onChange={images.handleFileSelect}
							className="sr-only"
							aria-label={t("form.images.addImages")}
						/>
					</label>
				) : null}

				{!!images.imageError && (
					<p className="mt-2 text-sm text-destructive">{images.imageError}</p>
				)}
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
						{images.uploadProgress ??
							(isSubmitting ? t("form.submit.saving") : (submitLabel ?? t("create.submitLabel")))}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
