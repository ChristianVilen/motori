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
import type { BrowseSearchParams } from "~/lib/validators";

interface FilterDrawerProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	totalCount: number;
	open: boolean;
	onClose: () => void;
}

export function FilterDrawer({ search, hasQuery, totalCount, open, onClose }: FilterDrawerProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	function updateFilter(updates: Partial<BrowseSearchParams>) {
		navigate({
			to: "/listings",
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
			to: "/listings",
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
			<div className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background px-5 pt-4 pb-6">
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
							<input
								type="number"
								placeholder={t("filters.priceMinPlaceholder")}
								defaultValue={search.price_min ?? ""}
								onBlur={(e) =>
									updateFilter({
										price_min: e.target.value ? Number(e.target.value) : undefined,
									})
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.currentTarget.blur();
									}
								}}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							/>
							<span className="text-muted">–</span>
							<input
								type="number"
								placeholder={t("filters.priceMaxPlaceholder")}
								defaultValue={search.price_max ?? ""}
								onBlur={(e) =>
									updateFilter({
										price_max: e.target.value ? Number(e.target.value) : undefined,
									})
								}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.currentTarget.blur();
									}
								}}
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
