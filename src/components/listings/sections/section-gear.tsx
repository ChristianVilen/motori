// Gear category section adapter.
// Owns: gear_type, size, condition, price. Title is rendered by the shell.

import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { useTranslation } from "~/lib/i18n";
import type { CONDITIONS, GEAR_TYPES, GearFormData, ListingFormData } from "~/lib/validators";
import { ConditionSelect, FieldError } from "./shared-fields";
import type { CategoryFormSection, SharedPayload } from "./types";

type Condition = (typeof CONDITIONS)[number];
type GearTypeValue = (typeof GEAR_TYPES)[number];

const GEAR_TYPE_LABELS: [GearTypeValue, string][] = [
	["helmet", "Kypärä"],
	["jacket", "Takki"],
	["pants", "Housut"],
	["boots", "Saappaat"],
	["gloves", "Käsineet"],
	["other", "Muu"],
];

export interface GearFieldValues {
	gear_gear_type: GearTypeValue | "";
	gear_size: string | null;
	gear_condition: Condition | "";
	gear_price: number;
}

export const gearSection: CategoryFormSection<"gear", GearFieldValues> = {
	category: "gear",
	defaultValues: (initial) => {
		const v = initial?.category === "gear" ? initial : undefined;
		return {
			gear_gear_type: v?.gear_type ?? "",
			gear_size: v?.size ?? null,
			gear_condition: v?.condition ?? "",
			gear_price: v?.price ?? ("" as unknown as number),
		};
	},
	fieldKeys: ["gear_gear_type", "gear_size", "gear_condition", "gear_price"],
	toPayload: (
		shared: SharedPayload,
		value: GearFieldValues,
	): Extract<ListingFormData, { category: "gear" }> => ({
		category: "gear",
		title: shared.title,
		city: shared.city,
		region: shared.region,
		postal_code: shared.postal_code,
		description: shared.description,
		gear_type: value.gear_gear_type as GearFormData["gear_type"],
		size: value.gear_size,
		condition: value.gear_condition as GearFormData["condition"],
		price: value.gear_price,
		images: shared.images,
	}),
};

interface GearFieldsProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack-form prop
	form: any;
}

export function GearFields({ form }: GearFieldsProps) {
	const { t } = useTranslation("listings");

	return (
		<section className="rounded-lg border border-border bg-card p-6">
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
				{t("form.sections.gearDetails")}
			</h2>
			<div className="space-y-4">
				<form.Field name="gear_gear_type">
					{(field: {
						state: { value: string; meta: { errors: unknown[] } };
						handleChange: (v: string) => void;
					}) => (
						<div>
							<label className="mb-1 block text-sm font-medium text-foreground">
								Varustetyyppi <span className="text-destructive">*</span>
							</label>
							<Select value={field.state.value ?? ""} onValueChange={(v) => field.handleChange(v)}>
								<SelectTrigger>
									<SelectValue placeholder="Valitse tyyppi" />
								</SelectTrigger>
								<SelectContent>
									{GEAR_TYPE_LABELS.map(([v, l]) => (
										<SelectItem key={v} value={v}>
											{l}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>
				<div className="grid grid-cols-2 gap-4">
					<form.Field name="gear_size">
						{(field: {
							state: { value: string | null };
							handleChange: (v: string | null) => void;
						}) => (
							<div>
								<label
									htmlFor="gear_size"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									Koko
								</label>
								<Input
									id="gear_size"
									value={field.state.value ?? ""}
									onChange={(e) => field.handleChange(e.target.value || null)}
									maxLength={20}
								/>
							</div>
						)}
					</form.Field>
					<form.Field name="gear_condition">
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
				</div>
				<form.Field name="gear_price">
					{(field: {
						state: { value: number | ""; meta: { errors: unknown[] } };
						handleBlur: () => void;
						handleChange: (v: number) => void;
					}) => (
						<div>
							<label
								htmlFor="gear_price"
								className="mb-1 block text-sm font-medium text-foreground"
							>
								Hinta (€) <span className="text-destructive">*</span>
							</label>
							<Input
								id="gear_price"
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
