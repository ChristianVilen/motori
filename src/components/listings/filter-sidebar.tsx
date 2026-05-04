import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { MOTORCYCLE_TYPES, REGIONS } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { type BrowseSearchParams, countActiveFilters } from "~/lib/validators";
import { FilterControls, type FilterMake } from "./filter-controls";

interface FilterSidebarProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	makes: FilterMake[];
}

export function FilterSidebar({ search, hasQuery, makes }: FilterSidebarProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const activeFilterCount = countActiveFilters(search);

	function updateFilter(updates: Partial<BrowseSearchParams>) {
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ ...prev, ...updates, cursor: undefined }),
			replace: true,
		});
	}

	function toggleArrayFilter(key: "type" | "license", value: string) {
		const current = search[key] ?? [];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
		updateFilter({ [key]: next.length > 0 ? next : undefined });
	}

	function clearAll() {
		navigate({ to: "/ilmoitukset", search: {}, replace: true });
	}

	return (
		<aside className="w-[260px] shrink-0 space-y-6">
			{/* Header */}
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

			<FilterControls
				search={search}
				hasQuery={hasQuery}
				makes={makes}
				idPrefix="filter"
				inputHeight="h-9"
			/>

			{/* Active filter chips */}
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
