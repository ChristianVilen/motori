import type { TFunction } from "i18next";
import { formatNumber, useTranslation } from "~/lib/i18n";
import type { ListingForDisplay } from "~/lib/listings-detail";
import { formatPower } from "~/lib/power";

type FactSource = Pick<ListingForDisplay, "sale" | "rental" | "gear" | "part"> & {
	listing: Pick<ListingForDisplay["listing"], "year" | "engine_cc" | "required_license">;
};
type Fact = [label: string, value: string | number | null | undefined];

function factRows(
	{ listing, sale, gear, part, rental }: FactSource,
	t: TFunction,
	locale: string,
): Fact[] {
	const engine =
		listing.engine_cc == null ? null : `${formatNumber(listing.engine_cc, locale)} cm³`;
	if (sale) {
		return [
			[t("form.fields.year"), listing.year],
			[
				t("form.fields.kmDriven"),
				sale.km_driven == null ? null : `${formatNumber(sale.km_driven, locale)} km`,
			],
			[t("detail.facts.engine"), engine],
			[t("detail.facts.power"), sale.power_kw == null ? null : formatPower(sale.power_kw)],
			[t("filters.condition"), t(`form.conditions.${sale.condition}`)],
			[t("form.fields.color"), sale.color],
			[t("detail.facts.owners"), sale.owner_count],
			[
				t("detail.facts.trade"),
				t(sale.trade_possible ? "detail.facts.tradeYes" : "detail.facts.tradeNo"),
			],
		];
	}
	if (gear) {
		return [
			[t("form.fields.type"), t(`filters.gearTypes.${gear.gear_type}`)],
			[t("form.fields.gearBrand"), gear.brand],
			[t("filters.size"), gear.size === "muu" ? t("filters.otherSize") : gear.size],
			[t("filters.condition"), t(`form.conditions.${gear.condition}`)],
		];
	}
	if (part) {
		return [
			[
				t("detail.facts.partCategory"),
				t(`card.partCategory.${part.part_category}`, { defaultValue: "" }),
			],
			[
				t("detail.facts.fits"),
				[part.compatible_make_name, part.compatible_model_name].filter(Boolean).join(" "),
			],
			[t("form.fields.oemNumber"), part.oem_number],
			[t("filters.condition"), t(`form.conditions.${part.condition}`)],
		];
	}
	if (rental) {
		return [
			[t("form.fields.year"), listing.year],
			[t("detail.facts.engine"), engine],
			[t("filters.license"), listing.required_license],
			[
				t("detail.facts.mileage"),
				rental.mileage_limit == null
					? t("detail.facts.unlimited")
					: t("detail.facts.kmPerDay", { km: formatNumber(rental.mileage_limit, locale) }),
			],
		];
	}
	return [];
}

export function ListingFacts({ data }: { data: FactSource }) {
	const { t, i18n } = useTranslation("listings");
	return (
		<dl
			data-testid="listing-facts"
			className="order-4 mt-[22px] grid grid-cols-2 gap-x-4 border-t border-border"
		>
			{factRows(data, t, i18n.language).map(([label, value]) =>
				value == null || value === "" ? null : (
					<div key={label} className="min-w-0 border-b border-border pt-2.5 pb-[11px]">
						<dt className="text-[13px] text-muted">{label}</dt>
						<dd className="break-words font-medium tabular-nums">{value}</dd>
					</div>
				),
			)}
		</dl>
	);
}
