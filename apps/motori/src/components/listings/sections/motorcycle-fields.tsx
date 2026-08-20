// Shared motorcycle fields rendered for sale + rental categories.
// Owns: title, make/model, year, engine_cc, motorcycle_type, required_license.

import { Input } from "@motori/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@motori/ui/select";
import { MakeModelSelect } from "~/components/listings/make-model-select";
import { CURRENT_YEAR, LICENSE_CLASSES, MOTORCYCLE_TYPES } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { errorProps, FieldError, TitleField } from "./shared-fields";

interface MotorcycleFieldsProps {
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Form's TFormState is the merged shell shape — sections see a flat any here
	form: any;
	initialMakeId: string | null;
	initialModelId: string | null;
	modelRequired?: boolean;
}

export function MotorcycleFields({
	form,
	initialMakeId,
	initialModelId,
	modelRequired,
}: MotorcycleFieldsProps) {
	const { t } = useTranslation("listings");

	return (
		<section className="rounded-lg border border-border bg-card p-6">
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
				{t("form.sections.motorcycle")}
			</h2>
			<div className="space-y-4">
				<TitleField form={form} />

				<form.Field name="make_id">
					{(makeField: {
						handleChange: (v: string) => void;
						state: { meta: { errors: unknown[] } };
					}) => (
						<form.Field name="model_id">
							{(modelField: {
								handleChange: (v: string | null) => void;
								state: { meta: { errors: unknown[] } };
							}) => (
								<MakeModelSelect
									initialMakeId={initialMakeId}
									initialModelId={initialModelId}
									onMakeChange={(id) => makeField.handleChange(id)}
									onModelChange={(id) => modelField.handleChange(id)}
									makeError={makeField.state.meta.errors[0]}
									modelError={modelField.state.meta.errors[0]}
									modelRequired={modelRequired}
								/>
							)}
						</form.Field>
					)}
				</form.Field>

				<div className="grid grid-cols-2 gap-4">
					<form.Field name="year">
						{(field: {
							state: { value: number | ""; meta: { errors: unknown[] } };
							handleBlur: () => void;
							handleChange: (v: number) => void;
						}) => (
							<div>
								<label htmlFor="year" className="mb-1 block text-sm font-medium text-foreground">
									{t("form.fields.year")} <span className="text-destructive">*</span>
								</label>
								<Input
									id="year"
									{...errorProps("year", field.state.meta.errors)}
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
								<FieldError id="year" errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
					<form.Field name="engine_cc">
						{(field: {
							state: { value: number | null; meta: { errors: unknown[] } };
							handleBlur: () => void;
							handleChange: (v: number | null) => void;
						}) => (
							<div>
								<label
									htmlFor="engine_cc"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.engineCc")}
								</label>
								<Input
									id="engine_cc"
									{...errorProps("engine_cc", field.state.meta.errors)}
									type="number"
									min={50}
									max={3000}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
									}
								/>
								<FieldError id="engine_cc" errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</div>

				<div className="grid grid-cols-2 gap-4">
					<form.Field name="motorcycle_type">
						{(field: {
							state: { value: string; meta: { errors: unknown[] } };
							handleChange: (v: string) => void;
						}) => (
							<div>
								<label
									htmlFor="motorcycle_type"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.type")} <span className="text-destructive">*</span>
								</label>
								<Select value={field.state.value} onValueChange={(v) => field.handleChange(v)}>
									<SelectTrigger
										id="motorcycle_type"
										{...errorProps("motorcycle_type", field.state.meta.errors)}
									>
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
								<FieldError id="motorcycle_type" errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
					<form.Field name="required_license">
						{(field: {
							state: { value: string | null; meta: { errors: unknown[] } };
							handleChange: (v: string | null) => void;
						}) => (
							<fieldset
								className="min-w-0"
								// No errorProps(): aria-invalid is not allowed on a group; only aria-describedby links the error.
								aria-describedby={
									field.state.meta.errors.some((e) => e != null)
										? "required_license-error"
										: undefined
								}
							>
								<legend className="mb-1 block text-sm font-medium text-foreground">
									{t("form.fields.requiredLicense")}
								</legend>
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
								<FieldError id="required_license" errors={field.state.meta.errors} />
							</fieldset>
						)}
					</form.Field>
				</div>
			</div>
		</section>
	);
}

export const MOTORCYCLE_FIELD_KEYS = [
	"make_id",
	"model_id",
	"year",
	"engine_cc",
	"motorcycle_type",
	"required_license",
] as const;
