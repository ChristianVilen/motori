// Part category section adapter.
// Owns: part_category, compatible_make_id, condition, price. Title is rendered by the shell.

import { Input } from "~/components/ui/input";
import { useTranslation } from "~/lib/i18n";
import type { CONDITIONS, ListingFormData, PartFormData } from "~/lib/validators";
import { ConditionSelect, FieldError } from "./shared-fields";
import type { CategoryFormSection, SharedPayload } from "./types";

type Condition = (typeof CONDITIONS)[number];

export interface PartFieldValues {
	part_part_category: string;
	part_compatible_make_id: string | null;
	part_condition: Condition | "";
	part_price: number;
}

export const partSection: CategoryFormSection<"part", PartFieldValues> = {
	category: "part",
	defaultValues: (initial) => {
		const v = initial?.category === "part" ? initial : undefined;
		return {
			part_part_category: v?.part_category ?? "",
			part_compatible_make_id: v?.compatible_make_id ?? null,
			part_condition: v?.condition ?? "",
			part_price: v?.price ?? ("" as unknown as number),
		};
	},
	fieldKeys: ["part_part_category", "part_compatible_make_id", "part_condition", "part_price"],
	toPayload: (
		shared: SharedPayload,
		value: PartFieldValues,
	): Extract<ListingFormData, { category: "part" }> => ({
		category: "part",
		title: shared.title,
		city: shared.city,
		region: shared.region,
		postal_code: shared.postal_code,
		description: shared.description,
		part_category: value.part_part_category,
		compatible_make_id: value.part_compatible_make_id,
		condition: value.part_condition as PartFormData["condition"],
		price: value.part_price,
		images: shared.images,
	}),
};

interface PartFieldsProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack-form prop
	form: any;
}

export function PartFields({ form }: PartFieldsProps) {
	const { t } = useTranslation("listings");

	return (
		<section className="rounded-lg border border-border bg-card p-6">
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
				{t("form.sections.partDetails")}
			</h2>
			<div className="space-y-4">
				<form.Field name="part_part_category">
					{(field: {
						state: { value: string; meta: { errors: unknown[] } };
						handleChange: (v: string) => void;
					}) => (
						<div>
							<label
								htmlFor="part_part_category"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Osatyyppi <span className="text-destructive">*</span>
							</label>
							<Input
								id="part_part_category"
								placeholder="esim. Jarrulevyt, Ketjusarja, Peili"
								value={field.state.value ?? ""}
								onChange={(e) => field.handleChange(e.target.value)}
								maxLength={100}
							/>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
				<form.Field name="part_condition">
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
				<form.Field name="part_price">
					{(field: {
						state: { value: number | ""; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: number) => void;
					}) => (
						<div>
							<label
								htmlFor="part_price"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Hinta (€) <span className="text-destructive">*</span>
							</label>
							<Input
								id="part_price"
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
			</div>
		</section>
	);
}
