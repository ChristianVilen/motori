// Sale category section adapter.
// Owns: condition / km_driven / price / negotiable.
// Motorcycle fields are owned by the shell and passed via MotorcyclePayload.

import { Input } from "@motori/ui/input";
import { useTranslation } from "~/lib/i18n";
import type { CONDITIONS, ListingFormData, SaleFormData } from "~/lib/validators";
import { ConditionSelect, FieldError } from "./shared-fields";
import type { CategoryFormSection, MotorcyclePayload, SharedPayload } from "./types";

type Condition = (typeof CONDITIONS)[number];

export interface SaleFieldValues {
	sale_price: number;
	sale_condition: Condition | "";
	sale_km_driven: number | null;
	sale_negotiable: boolean;
}

export const saleSection: CategoryFormSection<"sale", SaleFieldValues> = {
	category: "sale",
	defaultValues: (initial) => {
		const v = initial?.category === "sale" ? initial : undefined;
		return {
			sale_price: v?.price ?? ("" as unknown as number),
			sale_condition: v?.condition ?? "",
			sale_km_driven: v?.km_driven ?? null,
			sale_negotiable: v?.negotiable ?? false,
		};
	},
	fieldKeys: ["sale_price", "sale_condition", "sale_km_driven", "sale_negotiable"],
	toPayload: (
		shared: SharedPayload,
		value: SaleFieldValues,
		moto?: MotorcyclePayload,
	): Extract<ListingFormData, { category: "sale" }> => {
		if (!moto) {
			throw new Error("moto is required for sale listings");
		}
		const m = moto;
		return {
			category: "sale",
			title: shared.title,
			city: shared.city,
			region: shared.region,
			postal_code: shared.postal_code,
			description: shared.description,
			make_id: m.make_id,
			model_id: m.model_id,
			year: m.year,
			engine_cc: m.engine_cc,
			motorcycle_type: m.motorcycle_type,
			required_license: m.required_license,
			condition: value.sale_condition as SaleFormData["condition"],
			km_driven: value.sale_km_driven,
			price: value.sale_price,
			negotiable: value.sale_negotiable,
			images: shared.images,
		};
	},
};

interface SaleFieldsProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack-form prop
	form: any;
}

export function SaleFields({ form }: SaleFieldsProps) {
	const { t } = useTranslation("listings");

	return (
		<section className="rounded-lg border border-border bg-card p-6">
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
				{t("form.sections.saleDetails")}
			</h2>
			<div className="space-y-4">
				<form.Field name="sale_price">
					{(field: {
						state: { value: number | ""; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: number) => void;
					}) => (
						<div>
							<label
								htmlFor="sale_price"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								{t("form.fields.salePrice")} <span className="text-destructive">*</span>
							</label>
							<Input
								id="sale_price"
								type="number"
								min={1}
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
				<form.Field name="sale_condition">
					{(field: {
						state: { value: string; meta: { errors: unknown[] } };
						handleChange: (v: string) => void;
					}) => (
						<ConditionSelect
							value={field.state.value ?? ""}
							onChange={field.handleChange}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
				<form.Field name="sale_km_driven">
					{(field: {
						state: { value: number | null };
						handleBlur: () => void;
						handleChange: (v: number | null) => void;
					}) => (
						<div className="w-1/2">
							<label
								htmlFor="sale_km_driven"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								{t("form.fields.kmDriven")}
							</label>
							<Input
								id="sale_km_driven"
								type="number"
								min={0}
								value={field.state.value ?? ""}
								onBlur={field.handleBlur}
								onChange={(e) =>
									field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
								}
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="sale_negotiable">
					{(field: { state: { value: boolean }; handleChange: (v: boolean) => void }) => (
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={field.state.value ?? false}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="h-4 w-4 rounded border-border"
							/>
							<span className="text-sm text-foreground">{t("form.fields.negotiable")}</span>
						</label>
					)}
				</form.Field>
			</div>
		</section>
	);
}
