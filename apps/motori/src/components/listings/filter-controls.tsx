import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import {
	CONDITIONS,
	GEAR_SIZES,
	GEAR_TYPES,
	getSortState,
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
	PART_CATEGORIES,
	REGIONS,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";
import { RangeInput } from "./range-input";

export interface FilterMake {
	id: string;
	name: string;
	slug: string;
}

export function useFilterActions(browseTo: string) {
	const navigate = useNavigate();

	function updateFilter(updates: Partial<BrowseSearchParams>) {
		navigate({
			to: browseTo,
			search: (prev: BrowseSearchParams) => ({ ...prev, ...updates, cursor: undefined }),
			replace: true,
			resetScroll: false,
		});
	}

	function toggleArrayFilter(key: "type" | "license", value: string) {
		navigate({
			to: browseTo,
			replace: true,
			resetScroll: false,
			search: (prev: BrowseSearchParams) => {
				const current = prev[key] ?? [];
				const next = current.includes(value)
					? current.filter((v) => v !== value)
					: [...current, value];
				return { ...prev, [key]: next.length ? next : undefined, cursor: undefined };
			},
		});
	}

	function clearAll() {
		navigate({
			to: browseTo,
			search: (prev: BrowseSearchParams) => ({
				view: prev.view,
				city: prev.view === "map" ? prev.city : undefined,
			}),
			replace: true,
			resetScroll: false,
		});
	}

	return { updateFilter, toggleArrayFilter, clearAll };
}

interface FilterContextValue {
	search: BrowseSearchParams;
	makes: FilterMake[];
	updateFilter: (updates: Partial<BrowseSearchParams>) => void;
	toggleArrayFilter: (key: "type" | "license", value: string) => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

function useFilterCtx() {
	const ctx = useContext(FilterContext);
	if (!ctx) {
		throw new Error("Filter block used outside FilterProvider");
	}
	return ctx;
}

type FilterProviderProps = FilterContextValue & { children: React.ReactNode };

export function FilterProvider({
	children,
	search,
	makes,
	updateFilter,
	toggleArrayFilter,
}: FilterProviderProps) {
	return (
		<FilterContext.Provider value={{ search, makes, updateFilter, toggleArrayFilter }}>
			{children}
		</FilterContext.Provider>
	);
}

export function RegionFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground md:text-sm`;
	return (
		<div>
			<label htmlFor={`filter-region`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.region")}
			</label>
			<select
				id={`filter-region`}
				value={search.region ?? ""}
				onChange={(e) => updateFilter({ region: e.target.value || undefined })}
				className={cls}
			>
				<option value="">{t("filters.regionAll")}</option>
				{REGIONS.map((r) => (
					<option key={r.value} value={r.value}>
						{r.label}
					</option>
				))}
			</select>
		</div>
	);
}

function Choices<T extends string>({
	label,
	values,
	labelFor,
	selected,
	toggle,
	id,
}: {
	label: string;
	values: readonly T[];
	labelFor: (value: T) => string;
	selected: (value: T) => boolean;
	toggle: (value: T) => void;
	id?: string;
}) {
	return (
		<fieldset id={id}>
			<legend className="mb-2 text-sm font-semibold">{label}</legend>
			<div className="flex flex-wrap gap-2">
				{values.map((value) => (
					<button
						type="button"
						key={value}
						aria-pressed={selected(value)}
						className="min-h-11 rounded-full border border-border bg-card px-3.5 text-sm aria-pressed:border-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
						onClick={() => toggle(value)}
					>
						{labelFor(value)}
					</button>
				))}
			</div>
		</fieldset>
	);
}
export function TypeFilter() {
	const { search, toggleArrayFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			label={t("filters.type")}
			values={MOTORCYCLE_TYPES.filter((m) => m.value !== "custom").map((m) => m.value)}
			labelFor={(v) => t(`filters.bikeTypes.${v}`)}
			selected={(v) => !!search.type?.includes(v)}
			toggle={(v) => toggleArrayFilter("type", v)}
		/>
	);
}
export function LicenseFilter() {
	const { search, toggleArrayFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			label={t("filters.license")}
			values={LICENSE_CLASSES.map((l) => l.value)}
			labelFor={(v) => v}
			selected={(v) => !!search.license?.includes(v)}
			toggle={(v) => toggleArrayFilter("license", v)}
		/>
	);
}

interface RangeFilterProps {
	id: "price" | "cc" | "year";
	label: string;
	minKey: "price_min" | "cc_min" | "year_min";
	maxKey: "price_max" | "cc_max" | "year_max";
	minPlaceholder: string;
	maxPlaceholder: string;
}

function RangeFilter({
	id,
	label,
	minKey,
	maxKey,
	minPlaceholder,
	maxPlaceholder,
}: RangeFilterProps) {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
			<div className="flex items-center gap-2">
				<RangeInput
					key={`${id}-min-${search[minKey]}`}
					name={`filter-${id}-min`}
					label={`${label}, ${t("filters.minAriaLabel")}`}
					value={search[minKey]}
					placeholder={minPlaceholder}
					className={cls}
					onChange={(v) => updateFilter({ [minKey]: v })}
				/>
				<span className="text-muted">–</span>
				<RangeInput
					key={`${id}-max-${search[maxKey]}`}
					name={`filter-${id}-max`}
					label={`${label}, ${t("filters.maxAriaLabel")}`}
					value={search[maxKey]}
					placeholder={maxPlaceholder}
					className={cls}
					onChange={(v) => updateFilter({ [maxKey]: v })}
				/>
			</div>
		</div>
	);
}

export function PriceFilter({ labelKey = "filters.pricePerDay" }: { labelKey?: string }) {
	const { t } = useTranslation("listings");
	return (
		<RangeFilter
			id="price"
			label={t(labelKey)}
			minKey="price_min"
			maxKey="price_max"
			minPlaceholder={t("filters.priceMinPlaceholder")}
			maxPlaceholder={t("filters.priceMaxPlaceholder")}
		/>
	);
}

export function MakeFilter() {
	const { search, makes, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground md:text-sm`;
	return (
		<div>
			<label htmlFor={`filter-make`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.make")}
			</label>
			<select
				id={`filter-make`}
				data-testid={`filter-make`}
				value={search.make ?? ""}
				onChange={(e) => updateFilter({ make: e.target.value || undefined })}
				className={cls}
			>
				<option value="">{t("filters.makeAll")}</option>
				{makes.map((m) => (
					<option key={m.id} value={m.slug}>
						{m.name}
					</option>
				))}
			</select>
		</div>
	);
}

export function CcFilter() {
	const { t } = useTranslation("listings");
	return (
		<RangeFilter
			id="cc"
			label={t("filters.engineCc")}
			minKey="cc_min"
			maxKey="cc_max"
			minPlaceholder={t("filters.ccMinPlaceholder")}
			maxPlaceholder={t("filters.ccMaxPlaceholder")}
		/>
	);
}

export function YearFilter() {
	const { t } = useTranslation("listings");
	return (
		<RangeFilter
			id="year"
			label={t("filters.yearRange")}
			minKey="year_min"
			maxKey="year_max"
			minPlaceholder={t("filters.yearMinPlaceholder")}
			maxPlaceholder={t("filters.yearMaxPlaceholder")}
		/>
	);
}

export function SortFilter({
	queryDefault = "relevance",
}: {
	queryDefault?: "newest" | "relevance";
}) {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground md:text-sm`;
	const { current, options } = getSortState(search, queryDefault);
	return (
		<div>
			<label htmlFor={`filter-sort`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.sort")}
			</label>
			<select
				id={`filter-sort`}
				value={current.value}
				onChange={(e) => updateFilter({ sort: e.target.value as BrowseSearchParams["sort"] })}
				className={cls}
			>
				{options.map((s) => (
					<option key={s.value} value={s.value}>
						{t(`filters.sortOptions.${s.value}`)}
					</option>
				))}
			</select>
		</div>
	);
}

export function ConditionFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			id="filter-condition"
			label={t("filters.condition")}
			values={CONDITIONS}
			labelFor={(v) => t(`form.conditions.${v}`)}
			selected={(v) => search.condition === v}
			toggle={(v) => updateFilter({ condition: search.condition === v ? undefined : v })}
		/>
	);
}

export function GearTypeFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			id="filter-gear-type"
			label={t("filters.gearType")}
			values={GEAR_TYPES}
			labelFor={(v) => t(`filters.gearTypes.${v}`)}
			selected={(v) => search.gear_type === v}
			toggle={(v) => updateFilter({ gear_type: search.gear_type === v ? undefined : v })}
		/>
	);
}

export function SizeFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			id="filter-size"
			label={t("filters.size")}
			values={GEAR_SIZES}
			labelFor={(v) => (v === "muu" ? t("filters.otherSize") : v)}
			selected={(v) => search.size === v}
			toggle={(v) => updateFilter({ size: search.size === v ? undefined : v })}
		/>
	);
}

export function PartCategoryFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	return (
		<Choices
			id="filter-part-category"
			label={t("filters.partCategory")}
			values={PART_CATEGORIES.map((c) => c.value)}
			labelFor={(v) => t(`card.partCategory.${v}`)}
			selected={(v) => search.part_category === v}
			toggle={(v) => updateFilter({ part_category: search.part_category === v ? undefined : v })}
		/>
	);
}

export function KmMaxFilter() {
	const { search, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `h-11 w-full rounded-lg border border-input bg-card px-3 text-base md:text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.kmMax")}</p>
			<RangeInput
				key={`km-max-${search.km_max}`}
				name={`filter-km-max`}
				label={t("filters.kmMax")}
				value={search.km_max}
				placeholder={t("filters.kmMaxPlaceholder")}
				className={cls}
				onChange={(v) => updateFilter({ km_max: v })}
			/>
		</div>
	);
}
