// Small shared field renderers used by the category sections + the shell.

import { Input } from "@motori/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@motori/ui/select";
import { useTranslation } from "~/lib/i18n";

interface FieldErrorProps {
	errors: unknown[];
}
export function FieldError({ errors }: FieldErrorProps) {
	const first = errors.find((e) => e != null);
	if (first == null) {
		return null;
	}
	const msg = typeof first === "string" ? first : String(first);
	return <p className="mt-1 text-sm text-destructive">{msg}</p>;
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
				<SelectTrigger id="condition-select">
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
			<FieldError errors={errors} />
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
						value={field.state.value}
						onBlur={field.handleBlur}
						onChange={(e) => field.handleChange(e.target.value)}
					/>
					<p className="mt-1 text-xs text-muted">{t("form.fields.titleHint")}</p>
					<FieldError errors={field.state.meta.errors} />
				</div>
			)}
		</form.Field>
	);
}
