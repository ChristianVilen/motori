// Rental category section adapter.
// Owns: rental price fields (per-day, per-week, per-weekend, description, mileage limit).
// Motorcycle fields (title, make, year, ...) are rendered separately by the shell.

import { Input } from "~/components/ui/input";
import { useTranslation } from "~/lib/i18n";
import type { ListingFormData } from "~/lib/validators";
import { FieldError } from "./shared-fields";
import type { CategoryFormSection, SharedPayload } from "./types";

export interface RentalFieldValues {
	make_id: string;
	model_id: string | null;
	year: number;
	engine_cc: number | null;
	motorcycle_type: string;
	required_license: "A1" | "A2" | "A" | null;
	price_per_day: number;
	price_per_week: number | null;
	price_per_weekend: number | null;
	price_description: string;
	mileage_limit: number | null;
}

export const rentalSection: CategoryFormSection<"rental", RentalFieldValues> = {
	category: "rental",
	defaultValues: (initial) => {
		const v = initial?.category === "rental" ? initial : undefined;
		return {
			make_id: v?.make_id ?? "",
			model_id: v?.model_id ?? null,
			year: v?.year ?? ("" as unknown as number),
			engine_cc: v?.engine_cc ?? null,
			motorcycle_type: v?.motorcycle_type ?? "",
			required_license: v?.required_license ?? null,
			price_per_day: v?.price_per_day ?? ("" as unknown as number),
			price_per_week: v?.price_per_week ?? null,
			price_per_weekend: v?.price_per_weekend ?? null,
			price_description: v?.price_description ?? "",
			mileage_limit: v?.mileage_limit ?? null,
		};
	},
	fieldKeys: [
		"make_id",
		"model_id",
		"year",
		"engine_cc",
		"motorcycle_type",
		"required_license",
		"price_per_day",
		"price_per_week",
		"price_per_weekend",
		"price_description",
		"mileage_limit",
	],
	toPayload: (shared: SharedPayload, value: RentalFieldValues): Extract<ListingFormData, { category: "rental" }> => ({
		category: "rental",
		title: shared.title,
		city: shared.city,
		region: shared.region,
		postal_code: shared.postal_code,
		description: shared.description,
		make_id: value.make_id,
		model_id: value.model_id,
		year: value.year,
		engine_cc: value.engine_cc,
		motorcycle_type: value.motorcycle_type,
		required_license: value.required_license,
		price_per_day: value.price_per_day,
		price_per_week: value.price_per_week,
		price_per_weekend: value.price_per_weekend,
		price_description: value.price_description || null,
		mileage_limit: value.mileage_limit,
		images: shared.images,
	}),
};

interface RentalFieldsProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack-form prop
	form: any;
}

export function RentalFields({ form }: RentalFieldsProps) {
	const { t } = useTranslation("listings");

	return (
		<section className="rounded-lg border border-border bg-card p-6">
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
				{t("form.sections.price")}
			</h2>
			<div className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<form.Field name="price_per_day">
						{(field: {
							state: { value: number | ""; meta: { errors: unknown[] } };
							handleBlur: () => void;
							handleChange: (v: number) => void;
						}) => (
							<div>
								<label htmlFor="price_per_day" className="mb-1 block text-sm font-medium text-foreground">
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
						{(field: {
							state: { value: number | null; meta: { errors: unknown[] } };
							handleBlur: () => void;
							handleChange: (v: number | null) => void;
						}) => (
							<div>
								<label htmlFor="price_per_week" className="mb-1 block text-sm font-medium text-foreground">
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

				<form.Field name="price_per_weekend">
					{(field: {
						state: { value: number | null; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: number | null) => void;
					}) => (
						<div>
							<label htmlFor="price_per_weekend" className="mb-1 block text-sm font-medium text-foreground">
								{t("form.fields.pricePerWeekend")}
							</label>
							<Input
								id="price_per_weekend"
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

				<form.Field name="price_description">
					{(field: {
						state: { value: string; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: string) => void;
					}) => (
						<div>
							<label htmlFor="price_description" className="mb-1 block text-sm font-medium text-foreground">
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
					{(field: {
						state: { value: number | null; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: number | null) => void;
					}) => (
						<div className="w-1/3">
							<label htmlFor="mileage_limit" className="mb-1 block text-sm font-medium text-foreground">
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
	);
}

