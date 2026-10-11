import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { Textarea } from "@motori/ui/textarea";
import type { ReactNode } from "react";
import { useTranslation } from "~/lib/i18n";
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
				<div className="contract-grid">
					<Field
						label={t("fields.registration")}
						id="vehicle-registration"
						value={draft.vehicle.registration}
						editing={editing}
						onChange={(value) => update("vehicle", "registration", value)}
					/>
					<Field
						label={t("fields.vin")}
						id="vehicle-vin"
						value={draft.vehicle.vin}
						editing={editing}
						onChange={(value) => update("vehicle", "vin", value)}
					/>
					<Field
						label={t("fields.make")}
						id="vehicle-make"
						value={draft.vehicle.make}
						editing={editing}
						onChange={(value) => update("vehicle", "make", value)}
					/>
					<Field
						label={t("fields.model")}
						id="vehicle-model"
						value={draft.vehicle.model}
						editing={editing}
						onChange={(value) => update("vehicle", "model", value)}
					/>
					<Field
						label={t("fields.year")}
						id="vehicle-year"
						value={draft.vehicle.year}
						editing={editing}
						onChange={(value) => update("vehicle", "year", value)}
					/>
					<Field
						label={t("fields.mileage")}
						id="vehicle-mileage"
						value={draft.vehicle.mileage}
						editing={editing}
						onChange={(value) => update("vehicle", "mileage", value)}
					/>
					<Field
						label={t("fields.color")}
						id="vehicle-color"
						value={draft.vehicle.color}
						editing={editing}
						onChange={(value) => update("vehicle", "color", value)}
					/>
					<Field
						label={t("fields.power")}
						id="vehicle-power"
						value={draft.vehicle.power}
						editing={editing}
						onChange={(value) => update("vehicle", "power", value)}
					/>
				</div>
			</section>
			<div className="contract-parties">
				<section className="contract-section">
					<h2>{t("seller")}</h2>
					<div className="contract-grid">
						<Field
							label={t("fields.lastName")}
							id="seller-lastName"
							value={draft.seller.lastName}
							editing={editing}
							onChange={(value) => update("seller", "lastName", value)}
						/>
						<Field
							label={t("fields.firstNames")}
							id="seller-firstNames"
							value={draft.seller.firstNames}
							editing={editing}
							onChange={(value) => update("seller", "firstNames", value)}
						/>
						<Field
							label={t("fields.identity")}
							id="seller-identity"
							value={draft.seller.identity}
							editing={editing}
							onChange={(value) => update("seller", "identity", value)}
						/>
						<Field
							label={t("fields.address")}
							id="seller-address"
							value={draft.seller.address}
							editing={editing}
							onChange={(value) => update("seller", "address", value)}
						/>
						<Field
							label={t("fields.postalCode")}
							id="seller-postalCode"
							value={draft.seller.postalCode}
							editing={editing}
							onChange={(value) => update("seller", "postalCode", value)}
						/>
						<Field
							label={t("fields.city")}
							id="seller-city"
							value={draft.seller.city}
							editing={editing}
							onChange={(value) => update("seller", "city", value)}
						/>
						<Field
							label={t("fields.phone")}
							id="seller-phone"
							value={draft.seller.phone}
							editing={editing}
							onChange={(value) => update("seller", "phone", value)}
						/>
					</div>
				</section>
				<section className="contract-section">
					<h2>{t("buyer")}</h2>
					<div className="contract-grid">
						<Field
							label={t("fields.lastName")}
							id="buyer-lastName"
							value={draft.buyer.lastName}
							editing={editing}
							onChange={(value) => update("buyer", "lastName", value)}
						/>
						<Field
							label={t("fields.firstNames")}
							id="buyer-firstNames"
							value={draft.buyer.firstNames}
							editing={editing}
							onChange={(value) => update("buyer", "firstNames", value)}
						/>
						<Field
							label={t("fields.identity")}
							id="buyer-identity"
							value={draft.buyer.identity}
							editing={editing}
							onChange={(value) => update("buyer", "identity", value)}
						/>
						<Field
							label={t("fields.address")}
							id="buyer-address"
							value={draft.buyer.address}
							editing={editing}
							onChange={(value) => update("buyer", "address", value)}
						/>
						<Field
							label={t("fields.postalCode")}
							id="buyer-postalCode"
							value={draft.buyer.postalCode}
							editing={editing}
							onChange={(value) => update("buyer", "postalCode", value)}
						/>
						<Field
							label={t("fields.city")}
							id="buyer-city"
							value={draft.buyer.city}
							editing={editing}
							onChange={(value) => update("buyer", "city", value)}
						/>
						<Field
							label={t("fields.phone")}
							id="buyer-phone"
							value={draft.buyer.phone}
							editing={editing}
							onChange={(value) => update("buyer", "phone", value)}
						/>
					</div>
				</section>
			</div>
			<section className="contract-section">
				<h2>{t("sale")}</h2>
				<div className="contract-grid">
					<Field
						label={t("fields.price")}
						id="sale-price"
						value={draft.sale.price}
						editing={editing}
						onChange={(value) => update("sale", "price", value)}
					/>
					<Field
						label={t("fields.place")}
						id="sale-place"
						value={draft.sale.place}
						editing={editing}
						onChange={(value) => update("sale", "place", value)}
					/>
					<Field
						label={t("fields.date")}
						id="sale-date"
						value={draft.sale.date}
						editing={editing}
						onChange={(value) => update("sale", "date", value)}
					/>
					<Field
						label={t("fields.time")}
						id="sale-time"
						value={draft.sale.time}
						editing={editing}
						onChange={(value) => update("sale", "time", value)}
					/>
				</div>
			</section>
			<OptionalSection {...common} id="payment" title={t("payment")}>
				<div className="contract-grid">
					<Field
						label={t("fields.paymentMethod")}
						id="optional-paymentMethod"
						value={draft.optional.paymentMethod}
						editing={editing}
						onChange={(value) => update("optional", "paymentMethod", value)}
					/>
					<Field
						label={t("fields.paymentTime")}
						id="optional-paymentTime"
						value={draft.optional.paymentTime}
						editing={editing}
						onChange={(value) => update("optional", "paymentTime", value)}
					/>
				</div>
			</OptionalSection>
			<OptionalSection {...common} id="accessories" title={t("accessories")}>
				<div className="contract-grid">
					<Field
						label={t("fields.keys")}
						id="optional-keys"
						value={draft.optional.keys}
						editing={editing}
						onChange={(value) => update("optional", "keys", value)}
					/>
					<Field
						label={t("fields.serviceBook")}
						id="optional-serviceBook"
						value={draft.optional.serviceBook}
						editing={editing}
						onChange={(value) => update("optional", "serviceBook", value)}
					/>
					<Field
						label={t("fields.otherItems")}
						id="optional-otherItems"
						value={draft.optional.otherItems}
						editing={editing}
						onChange={(value) => update("optional", "otherItems", value)}
					/>
				</div>
			</OptionalSection>
			<OptionalSection {...common} id="assurances" title={t("assurances")}>
				<ul className="contract-statements">
					{statements.map((statement) =>
						draft.removedStatements.includes(statement) ? (
							<li key={statement} className="contract-controls contract-restoration">
								<span>{t(`statements.${statement}`)}</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									aria-label={controls("restoreNamed", { name: t(`statements.${statement}`) })}
									onClick={() => setDraft(restoreStatement(draft, statement))}
								>
									{controls("restore")}
								</Button>
							</li>
						) : (
							<li key={statement}>
								<span>{t(`statements.${statement}`)}</span>
								{!editing && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="contract-controls"
										aria-label={controls("removeNamed", { name: t(`statements.${statement}`) })}
										onClick={() => setDraft(removeStatement(draft, statement))}
									>
										{controls("remove")}
									</Button>
								)}
							</li>
						),
					)}
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
				<div className="contract-grid">
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
					<Field
						label={t("fields.sellerName")}
						id="sale-sellerName"
						value={draft.sale.sellerName}
						editing={editing}
						onChange={(value) => update("sale", "sellerName", value)}
					/>
					<Field
						label={t("fields.buyerName")}
						id="sale-buyerName"
						value={draft.sale.buyerName}
						editing={editing}
						onChange={(value) => update("sale", "buyerName", value)}
					/>
				</div>
			</section>
			{!editing && <p className="contract-document-footer">{t("footer")}</p>}
		</div>
	);
}
