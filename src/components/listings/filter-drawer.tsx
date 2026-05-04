import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect } from "react";
import {
	LICENSE_CLASSES,
	MOTORCYCLE_TYPES,
	REGIONS,
	SORT_OPTIONS,
	TYPE_EMOJI,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import { useFocusTrap } from "~/lib/use-focus-trap";
import type { BrowseSearchParams } from "~/lib/validators";
import { RangeInput } from "./range-input";

interface FilterDrawerProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	totalCount: number;
	open: boolean;
	onClose: () => void;
	makes: { id: string; name: string; slug: string }[];
}

export function FilterDrawer({
	search,
	hasQuery,
	totalCount,
	open,
	onClose,
	makes,
}: FilterDrawerProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const trapRef = useFocusTrap(open);

	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
			const onKey = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					onClose();
				}
			};
			window.addEventListener("keydown", onKey);
			return () => {
				window.removeEventListener("keydown", onKey);
				document.body.style.overflow = "";
			};
		}
		document.body.style.overflow = "";
	}, [open, onClose]);

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

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-50 flex flex-col justify-end">
			{/* Backdrop */}
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
				tabIndex={-1}
				aria-label={t("filters.closeBackdropAriaLabel")}
			/>

			{/* Drawer */}
			<div
				ref={trapRef}
				className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background px-5 pt-4 pb-6"
			>
				{/* Handle */}
				<div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-heading text-base font-semibold text-foreground">
						{t("filters.heading")}
					</h2>
					<button type="button" onClick={onClose} aria-label={t("filters.closeAriaLabel")}>
						<X className="h-5 w-5 text-muted" />
					</button>
				</div>

				<div className="space-y-5">
					{/* Region */}
					<div>
						<label htmlFor="drawer-region" className="mb-1.5 block text-xs font-medium text-muted">
							{t("filters.region")}
						</label>
						<select
							id="drawer-region"
							value={search.region ?? ""}
							onChange={(e) => updateFilter({ region: e.target.value || undefined })}
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
										className={`rounded-md px-2 py-2 text-sm font-medium transition-colors ${
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
										className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-colors ${
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
								name="drawer-price-min"
								value={search.price_min}
								placeholder={t("filters.priceMinPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								onChange={(v) => updateFilter({ price_min: v })}
							/>
							<span className="text-muted">–</span>
							<RangeInput
								key={`${search.price_max}`}
								name="drawer-price-max"
								value={search.price_max}
								placeholder={t("filters.priceMaxPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								onChange={(v) => updateFilter({ price_max: v })}
							/>
						</div>
					</div>

					{/* Brand */}
					<div>
						<label htmlFor="drawer-make" className="mb-1.5 block text-xs font-medium text-muted">
							{t("filters.make")}
						</label>
						<select
							id="drawer-make"
							data-testid="drawer-make"
							value={search.make ?? ""}
							onChange={(e) => updateFilter({ make: e.target.value || undefined })}
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
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
								name="drawer-cc-min"
								value={search.cc_min}
								placeholder={t("filters.ccMinPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								onChange={(v) => updateFilter({ cc_min: v })}
							/>
							<span className="text-muted">–</span>
							<RangeInput
								key={`${search.cc_max}`}
								name="drawer-cc-max"
								value={search.cc_max}
								placeholder={t("filters.ccMaxPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
								name="drawer-year-min"
								value={search.year_min}
								placeholder={t("filters.yearMinPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								onChange={(v) => updateFilter({ year_min: v })}
							/>
							<span className="text-muted">–</span>
							<RangeInput
								key={`${search.year_max}`}
								name="drawer-year-max"
								value={search.year_max}
								placeholder={t("filters.yearMaxPlaceholder")}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								onChange={(v) => updateFilter({ year_max: v })}
							/>
						</div>
					</div>

					{/* Sort */}
					<div>
						<label htmlFor="drawer-sort" className="mb-1.5 block text-xs font-medium text-muted">
							{t("filters.sort")}
						</label>
						<select
							id="drawer-sort"
							value={search.sort ?? (hasQuery ? "relevance" : "newest")}
							onChange={(e) =>
								updateFilter({
									sort: e.target.value as BrowseSearchParams["sort"],
								})
							}
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
						>
							{SORT_OPTIONS.filter((s) => s.value !== "relevance" || hasQuery).map((s) => (
								<option key={s.value} value={s.value}>
									{s.label}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Bottom buttons */}
				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={clearAll}
						className="flex-1 rounded-lg border border-border py-3 text-sm font-medium text-foreground"
					>
						{t("filters.clearAll")}
					</button>
					<button
						type="button"
						onClick={onClose}
						className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-white"
					>
						{t("filters.showResults", { total: totalCount })}
					</button>
				</div>
			</div>
		</div>
	);
}
