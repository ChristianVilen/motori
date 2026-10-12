import { cn } from "@motori/ui/cn";
import type { ReactNode } from "react";
import fiContract from "~/lib/i18n/resources/fi/contract";
import {
	type Contract,
	type FieldGroup,
	fieldNames,
	type OptionalBlock,
	remove,
	restore,
	statements,
} from "~/lib/sale-contract";
import { RemoveButton, RestoreLine } from "./removal";

type ContractProps = {
	draft: Contract;
	onChange: (draft: Contract) => void;
};

// The contract is always printed in Finnish, so its text comes from the Finnish resource
// and not from the UI language. Only the screen-only remove and restore controls are translated.
export function ContractDocument({ draft, onChange }: ContractProps) {
	const props = { draft, onChange };

	return (
		<article lang="fi" className="sale-contract-document" data-testid="contract-document">
			<h2 className="contract-title">{fiContract.title}</h2>

			<FieldSection draft={draft} group="vehicle" />

			<div className="contract-parties">
				<FieldSection draft={draft} group="seller" />
				<FieldSection draft={draft} group="buyer" />
			</div>

			<FieldSection draft={draft} group="sale" />

			<OptionalSection {...props} block="payment">
				<FieldGrid draft={draft} group="payment" />
			</OptionalSection>

			<OptionalSection {...props} block="accessories">
				<FieldGrid draft={draft} group="accessories" />
			</OptionalSection>

			<OptionalSection {...props} block="assurances">
				<StatementList {...props} />
			</OptionalSection>

			<OptionalSection {...props} block="defects" long>
				<p className="contract-written contract-prose">{draft.defects}</p>
			</OptionalSection>

			<OptionalSection {...props} block="terms" long>
				<p className="contract-written contract-prose">{draft.terms}</p>
			</OptionalSection>

			<section className="contract-section">
				<h3>{fiContract.sections.signatures}</h3>
				<div className="contract-grid">
					<WrittenField label={fiContract.fields.sellerSignature} className="contract-signature" />
					<WrittenField label={fiContract.fields.buyerSignature} className="contract-signature" />
					<WrittenField label={fiContract.fields.sellerName} value={draft.signatures.sellerName} />
					<WrittenField label={fiContract.fields.buyerName} value={draft.signatures.buyerName} />
				</div>
			</section>

			<p className="contract-footer">{fiContract.footer}</p>
		</article>
	);
}

function FieldSection({ draft, group }: { draft: Contract; group: FieldGroup }) {
	return (
		<section className="contract-section">
			<h3>{fiContract.sections[group]}</h3>
			<FieldGrid draft={draft} group={group} />
		</section>
	);
}

function OptionalSection({
	draft,
	onChange,
	block,
	long = false,
	children,
}: ContractProps & { block: OptionalBlock; long?: boolean; children: ReactNode }) {
	const title = fiContract.sections[block];

	if (draft.removed.includes(block)) {
		return <RestoreLine label={title} onRestore={() => onChange(restore(draft, block))} />;
	}

	return (
		<section className={cn("contract-section", long && "contract-long")}>
			<div className="contract-heading">
				<h3>{title}</h3>
				<RemoveButton label={title} onRemove={() => onChange(remove(draft, block))} />
			</div>
			{children}
		</section>
	);
}

function FieldGrid({ draft, group }: { draft: Contract; group: FieldGroup }) {
	const values: Record<string, string> = draft[group];

	return (
		<div className="contract-grid">
			{fieldNames[group].map((key) => (
				<WrittenField key={key} label={fiContract.fields[key]} value={values[key]} />
			))}
		</div>
	);
}

function StatementList({ draft, onChange }: ContractProps) {
	return (
		<ul className="contract-statements">
			{statements.map((statement) => {
				const label = fiContract.statements[statement];

				if (draft.removed.includes(statement)) {
					return (
						<li key={statement}>
							<RestoreLine label={label} onRestore={() => onChange(restore(draft, statement))} />
						</li>
					);
				}

				return (
					<li key={statement}>
						<span>{label}</span>
						<RemoveButton label={label} onRemove={() => onChange(remove(draft, statement))} />
					</li>
				);
			})}
		</ul>
	);
}

function WrittenField({
	label,
	value = "",
	className,
}: {
	label: string;
	value?: string;
	className?: string;
}) {
	return (
		<div className={className}>
			<span className="contract-label">{label}</span>
			<div className="contract-written">{value}</div>
		</div>
	);
}
