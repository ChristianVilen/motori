import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { Textarea } from "@motori/ui/textarea";
import type { ReactNode } from "react";
import { useTranslation } from "~/lib/i18n";
import type fiContract from "~/lib/i18n/resources/fi/contract";
import {
	type Contract,
	type OptionalBlock,
	removeBlock,
	removeStatement,
	restoreBlock,
	restoreStatement,
	statements,
} from "~/lib/sale-contract";

type LayoutProps = {
	draft: Contract;
	setDraft: (draft: Contract) => void;
	mode: "edit" | "document";
};

type FieldName = keyof typeof fiContract.fields;
const vehicleFields = [
	"registration",
	"vin",
	"make",
	"model",
	"year",
	"mileage",
	"color",
	"power",
] satisfies (keyof Contract["vehicle"])[];
const partyFields = [
	"lastName",
	"firstNames",
	"identity",
	"address",
	"postalCode",
	"city",
	"phone",
] satisfies (keyof Contract["seller"])[];
const saleFields = ["price", "place", "date", "time"] satisfies (keyof Contract["sale"])[];
const paymentFields = ["paymentMethod", "paymentTime"] satisfies (keyof Contract["optional"])[];
const accessoryFields = [
	"keys",
	"serviceBook",
	"otherItems",
] satisfies (keyof Contract["optional"])[];
const signatureFields = ["sellerName", "buyerName"] satisfies (keyof Contract["sale"])[];

function Field({
	label,
	value,
	id,
	editing,
	onChange,
	multiline = false,
}: {
	label: string;
	value: string;
	id: string;
	editing: boolean;
	onChange: (value: string) => void;
	multiline?: boolean;
}) {
	if (!editing) {
		return (
			<div className={multiline ? "contract-value contract-prose" : "contract-value"}>
				<span className="contract-label">{label}</span>
				<div className="contract-written">{value || "\u00a0"}</div>
			</div>
		);
	}
	return (
		<div className={multiline ? "col-span-full" : ""}>
			<label htmlFor={id} className="mb-1 block text-sm font-medium">
				{label}
			</label>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					rows={3}
				/>
			) : (
				<Input
					id={id}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					autoComplete="off"
				/>
			)}
		</div>
	);
}

function FieldGrid<Key extends FieldName>({
	group,
	fields,
	values,
	mode,
	onChange,
	children,
}: {
	group: "vehicle" | "seller" | "buyer" | "sale" | "optional";
	fields: readonly Key[];
	values: Record<Key, string>;
	mode: LayoutProps["mode"];
	onChange: (key: Key, value: string) => void;
	children?: ReactNode;
}) {
	const { t } = useTranslation("contract", { lng: mode === "document" ? "fi" : undefined });
	return (
		<div className="contract-grid">
			{children}
			{fields.map((key) => (
				<Field
					key={key}
					label={t(`fields.${key}`)}
					id={`${group}-${key}`}
					value={values[key]}
					editing={mode === "edit"}
					onChange={(value) => onChange(key, value)}
				/>
			))}
		</div>
	);
}

function PartySection({
	party,
	draft,
	setDraft,
	mode,
}: LayoutProps & { party: "seller" | "buyer" }) {
	const { t } = useTranslation("contract", { lng: mode === "document" ? "fi" : undefined });
	return (
		<section className="contract-section">
			<h2>{t(party)}</h2>
			<FieldGrid
				group={party}
				fields={partyFields}
				values={draft[party]}
				mode={mode}
				onChange={(key, value) =>
					setDraft({ ...draft, [party]: { ...draft[party], [key]: value } })
				}
			/>
		</section>
	);
}

function OptionalSection({
	id,
	title,
	draft,
	setDraft,
	mode,
	children,
}: LayoutProps & { id: OptionalBlock; title: string; children: ReactNode }) {
	const { t } = useTranslation("contract");
	if (draft.removedBlocks.includes(id)) {
		return (
			<div className="contract-controls contract-restoration">
				<span>{title}</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label={t("restoreNamed", { name: title })}
					onClick={() => setDraft(restoreBlock(draft, id))}
				>
					{t("restore")}
				</Button>
			</div>
		);
	}
	return (
		<section
			className={
				id === "defects" || id === "terms" ? "contract-section contract-long" : "contract-section"
			}
		>
			<div className="contract-section-heading">
				<h2>{title}</h2>
				{mode === "document" && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="contract-controls"
						aria-label={t("removeNamed", { name: title })}
						onClick={() => setDraft(removeBlock(draft, id))}
					>
						{t("remove")}
					</Button>
				)}
			</div>
			{children}
		</section>
	);
}

export function ContractLayout({ draft, setDraft, mode }: LayoutProps) {
	const { t } = useTranslation("contract", { lng: mode === "document" ? "fi" : undefined });
	const { t: controls } = useTranslation("contract");
	const editing = mode === "edit";
	function update<Group extends "vehicle" | "seller" | "buyer" | "sale" | "optional">(
		group: Group,
		key: keyof Contract[Group],
		value: string,
	) {
		setDraft({ ...draft, [group]: { ...draft[group], [key]: value } });
	}
	const common = { draft, setDraft, mode };
	return (
		<div
			className={editing ? "contract-editor" : "sale-contract-document"}
			lang={editing ? undefined : "fi"}
			data-testid={editing ? "contract-editor" : "contract-document"}
		>
			{!editing && <h1 className="contract-document-title">{t("title")}</h1>}
			<section className="contract-section">
				<h2>{t("vehicle")}</h2>
				<FieldGrid
					group="vehicle"
					fields={vehicleFields}
					values={draft.vehicle}
					mode={mode}
					onChange={(key, value) => update("vehicle", key, value)}
				/>
			</section>
			<div className="contract-parties">
				<PartySection {...common} party="seller" />
				<PartySection {...common} party="buyer" />
			</div>
			<section className="contract-section">
				<h2>{t("sale")}</h2>
				<FieldGrid
					group="sale"
					fields={saleFields}
					values={draft.sale}
					mode={mode}
					onChange={(key, value) => update("sale", key, value)}
				/>
			</section>
			<OptionalSection {...common} id="payment" title={t("payment")}>
				<FieldGrid
					group="optional"
					fields={paymentFields}
					values={draft.optional}
					mode={mode}
					onChange={(key, value) => update("optional", key, value)}
				/>
			</OptionalSection>
			<OptionalSection {...common} id="accessories" title={t("accessories")}>
				<FieldGrid
					group="optional"
					fields={accessoryFields}
					values={draft.optional}
					mode={mode}
					onChange={(key, value) => update("optional", key, value)}
				/>
			</OptionalSection>
			<OptionalSection {...common} id="assurances" title={t("assurances")}>
				<ul className="contract-statements">
					{statements.map((statement) => {
						const removed = draft.removedStatements.includes(statement);
						const label = t(`statements.${statement}`);
						return (
							<li
								key={statement}
								className={removed ? "contract-controls contract-restoration" : undefined}
							>
								<span>{label}</span>
								{(removed || !editing) && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className={removed ? undefined : "contract-controls"}
										aria-label={controls(removed ? "restoreNamed" : "removeNamed", { name: label })}
										onClick={() =>
											setDraft(
												removed
													? restoreStatement(draft, statement)
													: removeStatement(draft, statement),
											)
										}
									>
										{controls(removed ? "restore" : "remove")}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			</OptionalSection>
			<OptionalSection {...common} id="defects" title={t("defects")}>
				<Field
					label={t("defects")}
					id="optional-defects"
					value={draft.optional.defects}
					editing={editing}
					multiline
					onChange={(value) => update("optional", "defects", value)}
				/>
			</OptionalSection>
			<OptionalSection {...common} id="terms" title={t("terms")}>
				<Field
					label={t("terms")}
					id="optional-terms"
					value={draft.optional.terms}
					editing={editing}
					multiline
					onChange={(value) => update("optional", "terms", value)}
				/>
			</OptionalSection>
			<section className="contract-section">
				<h2>{t("signatures")}</h2>
				<FieldGrid
					group="sale"
					fields={signatureFields}
					values={draft.sale}
					mode={mode}
					onChange={(key, value) => update("sale", key, value)}
				>
					{!editing && (
						<>
							<div className="contract-value contract-signature">
								<span className="contract-label">{t("fields.sellerSignature")}</span>
								<div className="contract-written">{"\u00a0"}</div>
							</div>
							<div className="contract-value contract-signature">
								<span className="contract-label">{t("fields.buyerSignature")}</span>
								<div className="contract-written">{"\u00a0"}</div>
							</div>
						</>
					)}
				</FieldGrid>
			</section>
			{!editing && <p className="contract-document-footer">{t("footer")}</p>}
		</div>
	);
}
