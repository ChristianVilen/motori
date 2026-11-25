import { X } from "lucide-react";
import { REGIONS } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";
import { type FilterMake, useFilterActions } from "./filter-controls";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chip list grows with supported filter fields
export function ActiveFilterChips({
	search,
	makes,
	browseTo,
	cityFilter,
}: {
	search: BrowseSearchParams;
	makes: FilterMake[];
	browseTo: string;
	cityFilter: boolean;
}) {
	const { t } = useTranslation("listings");
	const {
		updateFilter: onUpdateFilter,
		toggleArrayFilter: onToggleArrayFilter,
		clearAll,
	} = useFilterActions(browseTo);
	return (
		<div className="mx-auto flex w-full max-w-[1304px] flex-wrap items-center gap-2 px-4 pt-3 lg:px-8">
			{cityFilter && !!search.city && (
				<FilterChip
					id="clear-city"
					label={search.city}
					onRemove={() => onUpdateFilter({ city: undefined })}
				/>
			)}
			{!!search.region && (
				<FilterChip
					label={REGIONS.find((r) => r.value === search.region)?.label ?? search.region}
					onRemove={() => onUpdateFilter({ region: undefined })}
				/>
			)}
			{search.type?.map((typeVal) => (
				<FilterChip
					key={typeVal}
					label={t(`filters.bikeTypes.${typeVal}`, { defaultValue: typeVal })}
					onRemove={() => onToggleArrayFilter("type", typeVal)}
				/>
			))}
			{search.license?.map((l) => (
				<FilterChip key={l} label={l} onRemove={() => onToggleArrayFilter("license", l)} />
			))}
			{search.price_min != null && (
				<FilterChip
					label={`Min ${search.price_min}€`}
					onRemove={() => onUpdateFilter({ price_min: undefined })}
				/>
			)}
			{search.price_max != null && (
				<FilterChip
					label={`Max ${search.price_max}€`}
					onRemove={() => onUpdateFilter({ price_max: undefined })}
				/>
			)}
			{!!search.make && (
				<FilterChip
					label={makes.find((m) => m.slug === search.make)?.name ?? search.make}
					onRemove={() => onUpdateFilter({ make: undefined })}
				/>
			)}
			{search.cc_min != null && (
				<FilterChip
					label={`≥${search.cc_min}cc`}
					onRemove={() => onUpdateFilter({ cc_min: undefined })}
				/>
			)}
			{search.cc_max != null && (
				<FilterChip
					label={`≤${search.cc_max}cc`}
					onRemove={() => onUpdateFilter({ cc_max: undefined })}
				/>
			)}
			{search.year_min != null && (
				<FilterChip
					label={`≥${search.year_min}`}
					onRemove={() => onUpdateFilter({ year_min: undefined })}
				/>
			)}
			{search.year_max != null && (
				<FilterChip
					label={`≤${search.year_max}`}
					onRemove={() => onUpdateFilter({ year_max: undefined })}
				/>
			)}
			{!!search.condition && (
				<FilterChip
					label={t(`form.conditions.${search.condition}`)}
					onRemove={() => onUpdateFilter({ condition: undefined })}
				/>
			)}
			{!!search.gear_type && (
				<FilterChip
					label={t(`filters.gearTypes.${search.gear_type}`)}
					onRemove={() => onUpdateFilter({ gear_type: undefined })}
				/>
			)}
			{!!search.size && (
				<FilterChip label={search.size} onRemove={() => onUpdateFilter({ size: undefined })} />
			)}
			{!!search.part_category && (
				<FilterChip
					label={t(`card.partCategory.${search.part_category}`)}
					onRemove={() => onUpdateFilter({ part_category: undefined })}
				/>
			)}
			{search.km_max != null && (
				<FilterChip
					label={`≤${search.km_max}km`}
					onRemove={() => onUpdateFilter({ km_max: undefined })}
				/>
			)}
			<button
				type="button"
				className="min-h-9 rounded-full px-2 text-sm underline"
				onClick={clearAll}
			>
				{t("filters.clearAll")}
			</button>
		</div>
	);
}

function FilterChip({ label, onRemove, id }: { label: string; onRemove: () => void; id?: string }) {
	const { t } = useTranslation("listings");
	return (
		<button
			type="button"
			data-testid={id}
			className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted-light px-3 text-sm"
			aria-label={t("filters.removeChipAriaLabel", { label })}
			onClick={onRemove}
		>
			{label}
			<X size={14} />
		</button>
	);
}
