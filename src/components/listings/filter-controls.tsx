import { useNavigate } from "@tanstack/react-router";
import {
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
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

export function useFilterActions(search: BrowseSearchParams) {
	const navigate = useNavigate();

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
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({ view: prev.view, city: prev.city }),
			replace: true,
		});
	}

	return { updateFilter, toggleArrayFilter, clearAll };
}

interface FilterControlsProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	makes: FilterMake[];
	/** HTML id/data-testid prefix — "filter" for sidebar, "drawer" for drawer */
	idPrefix: string;
	/** Tailwind height class for inputs/selects — "h-9" for sidebar, "h-10" for drawer */
	inputHeight: string;
}

export function FilterControls({
	search,
	hasQuery,
	makes,
	idPrefix,
	inputHeight,
}: FilterControlsProps) {
	const { t } = useTranslation("listings");
	const { updateFilter, toggleArrayFilter } = useFilterActions(search);

	const selectClass = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm text-foreground`;
	const rangeClass = `${inputHeight} w-full rounded-md border border-input bg-background px-3 text-sm`;
	const typeBtnPy = inputHeight === "h-9" ? "py-1.5" : "py-2";
	const licenseBtnPy = inputHeight === "h-9" ? "py-2" : "py-2.5";

	return (
		<>
			{/* Region */}
			<div>
				<label
					htmlFor={`${idPrefix}-region`}
					className="mb-1.5 block text-xs font-medium text-muted"
				>
					{t("filters.region")}
				</label>
				<select
					id={`${idPrefix}-region`}
					value={search.region ?? ""}
					onChange={(e) => updateFilter({ region: e.target.value || undefined })}
					className={selectClass}
				>
					<option value="">{t("filters.regionAll")}</option>
					{REGIONS.map((r) => (
						<option key={r.value} value={r.value}>
							{r.label}
						</option>
					))}
				</select>
			</div>

			{/* Motorcycle type */}
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
								className={`rounded-md px-2 ${typeBtnPy} text-xs font-medium transition-colors ${
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

			{/* License class */}
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
								className={`flex-1 rounded-md ${licenseBtnPy} text-sm font-semibold transition-colors ${
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

			{/* Price range */}
			<div>
				<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.pricePerDay")}</p>
				<div className="flex items-center gap-2">
					<RangeInput
						key={`price-min-${search.price_min}`}
						name={`${idPrefix}-price-min`}
						value={search.price_min}
						placeholder={t("filters.priceMinPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ price_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`price-max-${search.price_max}`}
						name={`${idPrefix}-price-max`}
						value={search.price_max}
						placeholder={t("filters.priceMaxPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ price_max: v })}
					/>
				</div>
			</div>

			{/* Brand */}
			<div>
				<label htmlFor={`${idPrefix}-make`} className="mb-1.5 block text-xs font-medium text-muted">
					{t("filters.make")}
				</label>
				<select
					id={`${idPrefix}-make`}
					data-testid={`${idPrefix}-make`}
					value={search.make ?? ""}
					onChange={(e) => updateFilter({ make: e.target.value || undefined })}
					className={selectClass}
				>
					<option value="">{t("filters.makeAll")}</option>
					{makes.map((m) => (
						<option key={m.id} value={m.slug}>
							{m.name}
						</option>
					))}
				</select>
			</div>

			{/* Engine cc range */}
			<div>
				<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.engineCc")}</p>
				<div className="flex items-center gap-2">
					<RangeInput
						key={`cc-min-${search.cc_min}`}
						name={`${idPrefix}-cc-min`}
						value={search.cc_min}
						placeholder={t("filters.ccMinPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ cc_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`cc-max-${search.cc_max}`}
						name={`${idPrefix}-cc-max`}
						value={search.cc_max}
						placeholder={t("filters.ccMaxPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ cc_max: v })}
					/>
				</div>
			</div>

			{/* Year range */}
			<div>
				<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.yearRange")}</p>
				<div className="flex items-center gap-2">
					<RangeInput
						key={`year-min-${search.year_min}`}
						name={`${idPrefix}-year-min`}
						value={search.year_min}
						placeholder={t("filters.yearMinPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ year_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`year-max-${search.year_max}`}
						name={`${idPrefix}-year-max`}
						value={search.year_max}
						placeholder={t("filters.yearMaxPlaceholder")}
						className={rangeClass}
						onChange={(v) => updateFilter({ year_max: v })}
					/>
				</div>
			</div>

			{/* Sort */}
			<div>
				<label htmlFor={`${idPrefix}-sort`} className="mb-1.5 block text-xs font-medium text-muted">
					{t("filters.sort")}
				</label>
				<select
					id={`${idPrefix}-sort`}
					value={search.sort ?? (hasQuery ? "relevance" : "newest")}
					onChange={(e) => updateFilter({ sort: e.target.value as BrowseSearchParams["sort"] })}
					className={selectClass}
				>
					{SORT_OPTIONS.filter((s) => s.value !== "relevance" || hasQuery).map((s) => (
						<option key={s.value} value={s.value}>
							{s.label}
						</option>
					))}
				</select>
			</div>
		</>
	);
}
