import { useNavigate } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import {
	CONDITION_LABELS,
	CONDITIONS,
	GEAR_SIZES,
	GEAR_TYPE_LABELS,
	GEAR_TYPES,
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
	PART_CATEGORIES,
	REGIONS,
	SORT_OPTIONS,
	TYPE_EMOJI,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";
import { RangeInput } from "./range-input";

export interface FilterMake {
	id: string;
	name: string;
	slug: string;
}

export function useFilterActions(search: BrowseSearchParams, browseTo: string) {
	const navigate = useNavigate();

	function updateFilter(updates: Partial<BrowseSearchParams>) {
		navigate({
			to: browseTo,
			search: (prev: BrowseSearchParams) => ({ ...prev, ...updates, cursor: undefined }),
			replace: true,
		});
	}

	function toggleArrayFilter(key: "type" | "license", value: string) {
		const current = search[key] ?? [];
		const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
		updateFilter({ [key]: next.length > 0 ? next : undefined });
	}

	function clearAll() {
		navigate({
			to: browseTo,
			search: (prev: BrowseSearchParams) => ({ view: prev.view, city: prev.city }),
			replace: true,
		});
	}

	return { updateFilter, toggleArrayFilter, clearAll };
}

interface FilterContextValue {
	search: BrowseSearchParams;
	makes: FilterMake[];
	hasQuery: boolean;
	idPrefix: string;
	inputHeight: string;
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

interface FilterProviderProps {
	children: React.ReactNode;
	search: BrowseSearchParams;
	makes: FilterMake[];
	hasQuery: boolean;
	idPrefix: string;
	inputHeight: string;
	updateFilter: (updates: Partial<BrowseSearchParams>) => void;
	toggleArrayFilter: (key: "type" | "license", value: string) => void;
}

export function FilterProvider({
	children,
	search,
	makes,
	hasQuery,
	idPrefix,
	inputHeight,
	updateFilter,
	toggleArrayFilter,
}: FilterProviderProps) {
	return (
		<FilterContext.Provider
			value={{ search, makes, hasQuery, idPrefix, inputHeight, updateFilter, toggleArrayFilter }}
		>
			{children}
		</FilterContext.Provider>
	);
}

export function RegionFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label htmlFor={`${idPrefix}-region`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.region")}
			</label>
			<select
				id={`${idPrefix}-region`}
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

export function TypeFilter() {
	const { search, inputHeight, toggleArrayFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const btnPy = inputHeight === "h-9" ? "py-1.5" : "py-2";
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.type")}</p>
			<div className="grid grid-cols-2 gap-1.5">
				{MOTORCYCLE_TYPES.filter((mt) => mt.value !== "custom").map((mt) => {
					const isActive = search.type?.includes(mt.value);
					return (
						<button
							key={mt.value}
							type="button"
							onClick={() => toggleArrayFilter("type", mt.value)}
							aria-pressed={isActive}
							className={`rounded-md px-2 ${btnPy} text-xs font-medium transition-colors ${
								isActive
									? "bg-primary text-primary-foreground"
									: "bg-muted-light text-foreground hover:bg-border"
							}`}
						>
							{TYPE_EMOJI[mt.value]} {mt.label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function LicenseFilter() {
	const { search, inputHeight, toggleArrayFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const btnPy = inputHeight === "h-9" ? "py-2" : "py-2.5";
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.license")}</p>
			<div className="flex gap-1.5">
				{LICENSE_CLASSES.map((l) => {
					const isActive = search.license?.includes(l.value);
					return (
						<button
							key={l.value}
							type="button"
							onClick={() => toggleArrayFilter("license", l.value)}
							aria-pressed={isActive}
							className={`flex-1 rounded-md ${btnPy} text-sm font-semibold transition-colors ${
								isActive
									? "bg-primary text-primary-foreground"
									: "bg-muted-light text-foreground hover:bg-border"
							}`}
						>
							{l.value}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function PriceFilter({ labelKey = "filters.pricePerDay" }: { labelKey?: string }) {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t(labelKey)}</p>
			<div className="flex items-center gap-2">
				<RangeInput
					key={`price-min-${search.price_min}`}
					name={`${idPrefix}-price-min`}
					value={search.price_min}
					placeholder={t("filters.priceMinPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ price_min: v })}
				/>
				<span className="text-muted">–</span>
				<RangeInput
					key={`price-max-${search.price_max}`}
					name={`${idPrefix}-price-max`}
					value={search.price_max}
					placeholder={t("filters.priceMaxPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ price_max: v })}
				/>
			</div>
		</div>
	);
}

export function MakeFilter() {
	const { search, makes, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label htmlFor={`${idPrefix}-make`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.make")}
			</label>
			<select
				id={`${idPrefix}-make`}
				data-testid={`${idPrefix}-make`}
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
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.engineCc")}</p>
			<div className="flex items-center gap-2">
				<RangeInput
					key={`cc-min-${search.cc_min}`}
					name={`${idPrefix}-cc-min`}
					value={search.cc_min}
					placeholder={t("filters.ccMinPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ cc_min: v })}
				/>
				<span className="text-muted">–</span>
				<RangeInput
					key={`cc-max-${search.cc_max}`}
					name={`${idPrefix}-cc-max`}
					value={search.cc_max}
					placeholder={t("filters.ccMaxPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ cc_max: v })}
				/>
			</div>
		</div>
	);
}

export function YearFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.yearRange")}</p>
			<div className="flex items-center gap-2">
				<RangeInput
					key={`year-min-${search.year_min}`}
					name={`${idPrefix}-year-min`}
					value={search.year_min}
					placeholder={t("filters.yearMinPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ year_min: v })}
				/>
				<span className="text-muted">–</span>
				<RangeInput
					key={`year-max-${search.year_max}`}
					name={`${idPrefix}-year-max`}
					value={search.year_max}
					placeholder={t("filters.yearMaxPlaceholder")}
					className={cls}
					onChange={(v) => updateFilter({ year_max: v })}
				/>
			</div>
		</div>
	);
}

export function SortFilter() {
	const { search, hasQuery, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label htmlFor={`${idPrefix}-sort`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.sort")}
			</label>
			<select
				id={`${idPrefix}-sort`}
				value={search.sort ?? (hasQuery ? "relevance" : "newest")}
				onChange={(e) => updateFilter({ sort: e.target.value as BrowseSearchParams["sort"] })}
				className={cls}
			>
				{SORT_OPTIONS.filter((s) => s.value !== "relevance" || hasQuery).map((s) => (
					<option key={s.value} value={s.value}>
						{s.label}
					</option>
				))}
			</select>
		</div>
	);
}

export function ConditionFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label
				htmlFor={`${idPrefix}-condition`}
				className="mb-1.5 block text-xs font-medium text-muted"
			>
				{t("filters.condition")}
			</label>
			<select
				id={`${idPrefix}-condition`}
				value={search.condition ?? ""}
				onChange={(e) =>
					updateFilter({
						condition: (e.target.value as BrowseSearchParams["condition"]) || undefined,
					})
				}
				className={cls}
			>
				<option value="">{t("filters.conditionAll")}</option>
				{CONDITIONS.map((c) => (
					<option key={c} value={c}>
						{CONDITION_LABELS[c]}
					</option>
				))}
			</select>
		</div>
	);
}

export function GearTypeFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label
				htmlFor={`${idPrefix}-gear-type`}
				className="mb-1.5 block text-xs font-medium text-muted"
			>
				{t("filters.gearType")}
			</label>
			<select
				id={`${idPrefix}-gear-type`}
				value={search.gear_type ?? ""}
				onChange={(e) =>
					updateFilter({
						gear_type: (e.target.value as BrowseSearchParams["gear_type"]) || undefined,
					})
				}
				className={cls}
			>
				<option value="">{t("filters.gearTypeAll")}</option>
				{GEAR_TYPES.map((g) => (
					<option key={g} value={g}>
						{GEAR_TYPE_LABELS[g]}
					</option>
				))}
			</select>
		</div>
	);
}

export function SizeFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label htmlFor={`${idPrefix}-size`} className="mb-1.5 block text-xs font-medium text-muted">
				{t("filters.size")}
			</label>
			<select
				id={`${idPrefix}-size`}
				value={search.size ?? ""}
				onChange={(e) =>
					updateFilter({ size: (e.target.value as BrowseSearchParams["size"]) || undefined })
				}
				className={cls}
			>
				<option value="">{t("filters.sizeAll")}</option>
				{GEAR_SIZES.map((s) => (
					<option key={s} value={s}>
						{s}
					</option>
				))}
			</select>
		</div>
	);
}

export function PartCategoryFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	return (
		<div>
			<label
				htmlFor={`${idPrefix}-part-category`}
				className="mb-1.5 block text-xs font-medium text-muted"
			>
				{t("filters.partCategory")}
			</label>
			<select
				id={`${idPrefix}-part-category`}
				value={search.part_category ?? ""}
				onChange={(e) =>
					updateFilter({
						part_category: (e.target.value as BrowseSearchParams["part_category"]) || undefined,
					})
				}
				className={cls}
			>
				<option value="">{t("filters.partCategoryAll")}</option>
				{PART_CATEGORIES.map((c) => (
					<option key={c.value} value={c.value}>
						{c.label}
					</option>
				))}
			</select>
		</div>
	);
}

export function KmMaxFilter() {
	const { search, idPrefix, inputHeight, updateFilter } = useFilterCtx();
	const { t } = useTranslation("listings");
	const cls = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm`;
	return (
		<div>
			<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.kmMax")}</p>
			<RangeInput
				key={`km-max-${search.km_max}`}
				name={`${idPrefix}-km-max`}
				value={search.km_max}
				placeholder={t("filters.kmMaxPlaceholder")}
				className={cls}
				onChange={(v) => updateFilter({ km_max: v })}
			/>
		</div>
	);
}
