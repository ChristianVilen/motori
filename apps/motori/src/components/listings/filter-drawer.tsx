import { X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "~/lib/i18n";
import { useFocusTrap } from "~/lib/use-focus-trap";
import type { BrowseSearchParams } from "~/lib/validators";
import { type FilterMake, FilterProvider, useFilterActions } from "./filter-controls";

interface FilterDrawerProps {
	search: BrowseSearchParams;
	hasQuery: boolean;
	totalCount: number;
	open: boolean;
	onClose: () => void;
	makes: FilterMake[];
	browseTo: string;
	children: React.ReactNode;
}

export function FilterDrawer({
	search,
	hasQuery,
	totalCount,
	open,
	onClose,
	makes,
	browseTo,
	children,
}: FilterDrawerProps) {
	const { t } = useTranslation("listings");
	const { clearAll, updateFilter, toggleArrayFilter } = useFilterActions(search, browseTo);
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

	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[1000] flex flex-col justify-end">
			<button
				type="button"
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
				tabIndex={-1}
				aria-label={t("filters.closeBackdropAriaLabel")}
			/>

			<div
				ref={trapRef}
				className="relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-background px-5 pt-4 pb-6"
			>
				<div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-heading text-base font-semibold text-foreground">
						{t("filters.heading")}
					</h2>
					<button type="button" onClick={onClose} aria-label={t("filters.closeAriaLabel")}>
						<X className="h-5 w-5 text-muted" />
					</button>
				</div>

				<FilterProvider
					search={search}
					hasQuery={hasQuery}
					makes={makes}
					idPrefix="drawer"
					inputHeight="h-10"
					updateFilter={updateFilter}
					toggleArrayFilter={toggleArrayFilter}
				>
					<div className="space-y-5">{children}</div>
				</FilterProvider>

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
