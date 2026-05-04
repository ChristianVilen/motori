import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SORT_OPTIONS,
	TYPE_EMOJI,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { type BrowseSearchParams, countActiveFilters } from "~/lib/validators";
import { RangeInput } from "./range-input";

interface Make {
	id: string;
	name: string;
	slug: string;
}

interface FilterSidebarProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	makes: Make[];
}

export function FilterSidebar({ search, hasQuery, makes }: FilterSidebarProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	function updateFilter(updates: Partial<BrowseSearchParams>) {
		navigate({
			to: "/ilmoitukset",
			search: (prev) => ({
				...prev,
				...updates,
				cursor: undefined,
			}),
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
			search: {},
			replace: true,
		});
	}

	const activeFilterCount = countActiveFilters(search);

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

			{/* Region */}
			<div>
				<label htmlFor="filter-region" className="mb-1.5 block text-xs font-medium text-muted">
					{t("filters.region")}
				</label>
				<select
					id="filter-region"
					value={search.region ?? ""}
					onChange={(e) => updateFilter({ region: e.target.value || undefined })}
					className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
					{MOTORCYCLE_TYPES.filter((t) => t.value !== "custom").map((t) => {
						const isActive = search.type?.includes(t.value);
						return (
							<button
								key={t.value}
								type="button"
								onClick={() => toggleArrayFilter("type", t.value)}
								aria-pressed={isActive}
								className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
									isActive
										? "bg-primary text-primary-foreground"
										: "bg-muted-light text-foreground hover:bg-border"
								}`}
							>
								{TYPE_EMOJI[t.value]} {t.label}
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
								className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
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
						key={`${search.price_min}`}
						name="filter-price-min"
						value={search.price_min}
						placeholder={t("filters.priceMinPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ price_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`${search.price_max}`}
						name="filter-price-max"
						value={search.price_max}
						placeholder={t("filters.priceMaxPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ price_max: v })}
					/>
				</div>
			</div>

			{/* Brand */}
			<div>
				<label htmlFor="filter-make" className="mb-1.5 block text-xs font-medium text-muted">
					{t("filters.make")}
				</label>
				<select
					id="filter-make"
					data-testid="filter-make"
					value={search.make ?? ""}
					onChange={(e) => updateFilter({ make: e.target.value || undefined })}
					className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
						key={`${search.cc_min}`}
						name="filter-cc-min"
						value={search.cc_min}
						placeholder={t("filters.ccMinPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ cc_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`${search.cc_max}`}
						name="filter-cc-max"
						value={search.cc_max}
						placeholder={t("filters.ccMaxPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ cc_max: v })}
					/>
				</div>
			</div>

			{/* Year range */}
			<div>
				<p className="mb-1.5 text-xs font-medium text-muted">{t("filters.yearRange")}</p>
				<div className="flex items-center gap-2">
					<RangeInput
						key={`${search.year_min}`}
						name="filter-year-min"
						value={search.year_min}
						placeholder={t("filters.yearMinPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ year_min: v })}
					/>
					<span className="text-muted">–</span>
					<RangeInput
						key={`${search.year_max}`}
						name="filter-year-max"
						value={search.year_max}
						placeholder={t("filters.yearMaxPlaceholder")}
						className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						onChange={(v) => updateFilter({ year_max: v })}
					/>
				</div>
			</div>

			{/* Sort */}
			<div>
				<label htmlFor="filter-sort" className="mb-1.5 block text-xs font-medium text-muted">
					{t("filters.sort")}
				</label>
				<select
					id="filter-sort"
					value={search.sort ?? (hasQuery ? "relevance" : "newest")}
					onChange={(e) =>
						updateFilter({
							sort: e.target.value as BrowseSearchParams["sort"],
						})
					}
					className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
				>
					{SORT_OPTIONS.filter((s) => s.value !== "relevance" || hasQuery).map((s) => (
						<option key={s.value} value={s.value}>
							{s.label}
						</option>
					))}
				</select>
			</div>

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
	makes: Make[];
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
