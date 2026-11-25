import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "~/lib/i18n";
import { useFocusTrap } from "~/lib/use-focus-trap";
import type { BrowseSearchParams } from "~/lib/validators";
import { type FilterMake, FilterProvider, useFilterActions } from "./filter-controls";

interface FilterDrawerProps {
	search: BrowseSearchParams;
	totalCount: number;
	onClose: () => void;
	makes: FilterMake[];
	browseTo: string;
	children: ReactNode;
}

export function FilterDrawer({
	search,
	totalCount,
	onClose,
	makes,
	browseTo,
	children,
}: FilterDrawerProps) {
	const { t } = useTranslation("listings");
	const { clearAll, ...actions } = useFilterActions(browseTo);
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) {
			return;
		}
		const opener = document.activeElement;
		const previous = document.body.style.overflow;
		dialog.showModal();
		document.body.style.overflow = "hidden";
		return () => {
			dialog.close();
			document.body.style.overflow = previous;
			if (opener instanceof HTMLElement && opener.isConnected) {
				opener.focus({ preventScroll: true });
			}
		};
	}, []);
	const panelRef = useFocusTrap(true);
	return (
		<dialog
			ref={ref}
			aria-labelledby="filter-heading"
			onCancel={(event) => {
				event.preventDefault();
				onClose();
			}}
			className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 text-foreground backdrop:bg-black/40"
		>
			<div className="flex h-full items-end md:justify-end">
				<button
					type="button"
					tabIndex={-1}
					aria-label={t("filters.closeBackdropAriaLabel")}
					onClick={onClose}
					className="absolute inset-0"
				/>
				<div
					ref={panelRef}
					className="relative flex max-h-[85dvh] w-full flex-col rounded-t-sheet bg-card shadow-xl md:h-full md:max-h-none md:w-[380px] md:rounded-l-sheet md:rounded-tr-none"
				>
					<div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border md:hidden" />
					<div className="flex items-center justify-between border-b border-border py-2 pr-2 pl-5">
						<h2 id="filter-heading" className="font-heading text-xl font-bold">
							{t("filters.heading")}
						</h2>
						<button
							type="button"
							onClick={onClose}
							aria-label={t("filters.closeAriaLabel")}
							className="grid size-11 place-items-center rounded-full hover:bg-muted-light"
						>
							<X size={20} />
						</button>
					</div>
					<FilterProvider search={search} makes={makes} {...actions}>
						<div className="grid min-h-0 flex-1 gap-[22px] overflow-y-auto overscroll-contain px-5 pt-[18px] pb-6">
							{children}
						</div>
					</FilterProvider>
					<div className="flex items-center gap-2.5 border-t border-border px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
						<button
							type="button"
							onClick={clearAll}
							className="min-h-11 px-2 text-sm font-medium underline"
						>
							{t("filters.clearAll")}
						</button>
						<button
							type="button"
							data-page-primary
							onClick={onClose}
							className="min-h-12 flex-1 rounded-full bg-reflector px-3 text-sm font-semibold text-foreground hover:bg-reflector-press"
						>
							{t("filters.showResults", { count: totalCount })}
						</button>
					</div>
				</div>
			</div>
		</dialog>
	);
}
