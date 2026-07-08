import { X } from "lucide-react";
import {
	CONDITION_LABELS,
	GEAR_TYPE_LABELS,
	MOTORCYCLE_TYPES,
	PART_CATEGORIES,
	REGIONS,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { type BrowseSearchParams, countActiveFilters } from "~/lib/validators";
import { type FilterMake, FilterProvider, useFilterActions } from "./filter-controls";

interface FilterSidebarProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	makes: FilterMake[];
	browseTo: string;
	children: React.ReactNode;
}

export function FilterSidebar({ search, hasQuery, makes, browseTo, children }: FilterSidebarProps) {
	const { t } = useTranslation("listings");
	const activeFilterCount = countActiveFilters(search);
	const { updateFilter, toggleArrayFilter, clearAll } = useFilterActions(search, browseTo);

	return (
		<aside className="w-full shrink-0 space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="font-heading text-sm font-semibold text-foreground">
					{t("filters.heading")}
				</h2>
				{activeFilterCount > 0 && (
					<button type="button" onClick={clearAll} className="text-xs text-accent hover:underline">
						{t("filters.clear")}
					</button>
				)}
			</div>

			<FilterProvider
				search={search}
				hasQuery={hasQuery}
				makes={makes}
				idPrefix="filter"
				inputHeight="h-9"
				updateFilter={updateFilter}
				toggleArrayFilter={toggleArrayFilter}
			>
				<div className="space-y-6">{children}</div>
			</FilterProvider>

			{activeFilterCount > 0 && (
				<ActiveFilterChips
					search={search}
					makes={makes}
					onUpdateFilter={updateFilter}
					onToggleArrayFilter={toggleArrayFilter}
				/>
			)}
		</aside>
	);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chip list grows with supported filter fields
function ActiveFilterChips({
	search,
	makes,
	onUpdateFilter,
	onToggleArrayFilter,
}: {
	search: BrowseSearchParams;
	makes: FilterMake[];
	onUpdateFilter: (updates: Partial<BrowseSearchParams>) => void;
	onToggleArrayFilter: (key: "type" | "license", value: string) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5 border-t border-border pt-4">
			{!!search.region && (
				<FilterChip
					label={REGIONS.find((r) => r.value === search.region)?.label ?? search.region}
					onRemove={() => onUpdateFilter({ region: undefined })}
				/>
			)}
			{search.type?.map((typeVal) => (
				<FilterChip
					key={typeVal}
					label={MOTORCYCLE_TYPES.find((mt) => mt.value === typeVal)?.label ?? typeVal}
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
					label={CONDITION_LABELS[search.condition]}
					onRemove={() => onUpdateFilter({ condition: undefined })}
				/>
			)}
			{!!search.gear_type && (
				<FilterChip
					label={GEAR_TYPE_LABELS[search.gear_type]}
					onRemove={() => onUpdateFilter({ gear_type: undefined })}
				/>
			)}
			{!!search.size && (
				<FilterChip label={search.size} onRemove={() => onUpdateFilter({ size: undefined })} />
			)}
			{!!search.part_category && (
				<FilterChip
					label={
						PART_CATEGORIES.find((c) => c.value === search.part_category)?.label ??
						search.part_category
					}
					onRemove={() => onUpdateFilter({ part_category: undefined })}
				/>
			)}
			{search.km_max != null && (
				<FilterChip
					label={`≤${search.km_max}km`}
					onRemove={() => onUpdateFilter({ km_max: undefined })}
				/>
			)}
		</div>
	);
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
	const { t } = useTranslation("listings");
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-muted-light px-2.5 py-1 text-xs text-foreground">
			{label}
			<button
				type="button"
				onClick={onRemove}
				className="text-muted hover:text-foreground"
				aria-label={t("filters.removeChipAriaLabel", { label })}
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}
