// Small shared field renderers used by the category sections + the shell.

import { Input } from "@motori/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@motori/ui/select";
import { useTranslation } from "~/lib/i18n";

interface FieldErrorProps {
	id: string;
	errors: unknown[];
}
export function FieldError({ id, errors }: FieldErrorProps) {
	const first = errors.find((e) => e != null);
	const msg = first == null ? undefined : String(first);
	// Always mounted: screen readers only announce changes inside a live region that
	// already exists. Empty <p> has no height, so it costs no layout.
	return (
		<p
			id={`${id}-error`}
			aria-live="polite"
			className={msg === undefined ? undefined : "mt-1 text-sm text-destructive"}
		>
			{msg}
		</p>
	);
}

// Spread onto the control that `<FieldError id=… />` describes.
export function errorProps(id: string, errors: unknown[]) {
	const invalid = errors.some((e) => e != null);
	return {
		"aria-invalid": invalid || undefined,
		"aria-describedby": invalid ? `${id}-error` : undefined,
	} as const;
}

const CONDITION_KEYS = ["new", "excellent", "good", "fair", "poor"] as const;

interface ConditionSelectProps {
	value: string;
	onChange: (v: string) => void;
	errors: unknown[];
}
export function ConditionSelect({ value, onChange, errors }: ConditionSelectProps) {
	const { t } = useTranslation("listings");
	return (
		<div>
			<label htmlFor="condition-select" className="mb-1 block text-sm font-medium text-foreground">
				{t("form.fields.condition")} <span className="text-destructive">*</span>
			</label>
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger id="condition-select" {...errorProps("condition-select", errors)}>
					<SelectValue placeholder={t("form.fields.conditionPlaceholder")} />
				</SelectTrigger>
				<SelectContent>
					{CONDITION_KEYS.map((key) => (
						<SelectItem key={key} value={key}>
							{t(`form.conditions.${key}`)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<FieldError id="condition-select" errors={errors} />
		</div>
	);
}

interface TitleFieldProps {
	// biome-ignore lint/suspicious/noExplicitAny: tanstack-form prop
	form: any;
}
export function TitleField({ form }: TitleFieldProps) {
	const { t } = useTranslation("listings");
	return (
		<form.Field name="title">
			{(field: {
				state: { value: string; meta: { errors: unknown[] } };
				handleBlur: () => void;
				handleChange: (v: string) => void;
			}) => (
				<div>
					<label htmlFor="title" className="mb-1 block text-sm font-medium text-foreground">
						{t("form.fields.title")} <span className="text-destructive">*</span>
					</label>
					<Input
						id="title"
						{...errorProps("title", field.state.meta.errors)}
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
					/>
					<p className="mt-1 text-xs text-muted">{t("form.fields.titleHint")}</p>
					<FieldError id="title" errors={field.state.meta.errors} />
				</div>
			)}
		</form.Field>
	);
}
