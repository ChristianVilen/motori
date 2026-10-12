import { Input } from "@motori/ui/input";
import { Textarea } from "@motori/ui/textarea";
import type { ReactNode } from "react";
import { useTranslation } from "~/lib/i18n";
import {
	type Contract,
	type FieldGroup,
	fieldId,
	fieldNames,
	type OptionalBlock,
	restore,
	statements,
} from "~/lib/sale-contract";
import { RestoreLine } from "./removal";

type ContractProps = {
	draft: Contract;
	onChange: (draft: Contract) => void;
};

export function ContractForm({ draft, onChange }: ContractProps) {
	const props = { draft, onChange };

	return (
		<div className="space-y-8 print:hidden" data-testid="contract-editor">
			<FieldSection {...props} group="vehicle" />

			<div className="grid gap-8 md:grid-cols-2">
				<FieldSection {...props} group="seller" />
				<FieldSection {...props} group="buyer" />
			</div>

			<FieldSection {...props} group="sale" />

			<OptionalSection {...props} block="payment">
				<FieldGrid {...props} group="payment" />
			</OptionalSection>

			<OptionalSection {...props} block="accessories">
				<FieldGrid {...props} group="accessories" />
			</OptionalSection>

			<OptionalSection {...props} block="assurances">
				<StatementList {...props} />
			</OptionalSection>

			<OptionalSection {...props} block="defects">
				<LongText {...props} field="defects" />
			</OptionalSection>

			<OptionalSection {...props} block="terms">
				<LongText {...props} field="terms" />
			</OptionalSection>

			<FieldSection {...props} group="signatures" />
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h2 className="mb-3 text-lg font-bold">{title}</h2>
			{children}
		</section>
	);
}

function FieldSection({ group, ...props }: ContractProps & { group: FieldGroup }) {
	const { t } = useTranslation("contract");

	return (
		<Section title={t(`sections.${group}`)}>
			<FieldGrid {...props} group={group} />
		</Section>
	);
}

function OptionalSection({
	draft,
	onChange,
	block,
	children,
}: ContractProps & { block: OptionalBlock; children: ReactNode }) {
	const { t } = useTranslation("contract");
	const title = t(`sections.${block}`);

	if (draft.removed.includes(block)) {
		return <RestoreLine label={title} onRestore={() => onChange(restore(draft, block))} />;
	}

	return <Section title={title}>{children}</Section>;
}

function FieldGrid({ draft, onChange, group }: ContractProps & { group: FieldGroup }) {
	const { t } = useTranslation("contract");
	const values: Record<string, string> = draft[group];

	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-3 max-[400px]:grid-cols-1">
			{fieldNames[group].map((key) => (
				<div key={key}>
					<label htmlFor={fieldId(group, key)} className="mb-1 block text-sm font-medium">
						{t(`fields.${key}`)}
					</label>
					<Input
						id={fieldId(group, key)}
						value={values[key]}
						autoComplete="off"
						onChange={(event) =>
							onChange({ ...draft, [group]: { ...values, [key]: event.target.value } })
						}
					/>
				</div>
			))}
		</div>
	);
}

function StatementList({ draft, onChange }: ContractProps) {
	const { t } = useTranslation("contract");

	return (
		<ul className="grid gap-2 text-sm">
			{statements.map((statement) => {
				const label = t(`statements.${statement}`);

				if (draft.removed.includes(statement)) {
					return (
						<li key={statement}>
							<RestoreLine label={label} onRestore={() => onChange(restore(draft, statement))} />
						</li>
					);
				}

				return <li key={statement}>{label}</li>;
			})}
		</ul>
	);
}

function LongText({ draft, onChange, field }: ContractProps & { field: "defects" | "terms" }) {
	const { t } = useTranslation("contract");

	return (
		<Textarea
			aria-label={t(`sections.${field}`)}
			rows={3}
			value={draft[field]}
			onChange={(event) => onChange({ ...draft, [field]: event.target.value })}
		/>
	);
}
