import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { BROWSE_CATEGORIES, getSortState, type SortOption } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";
import { useDropdownMenu } from "../use-dropdown-menu";

interface MobileBrowseControlsProps {
	category: ListingCategory;
	browseTo: string;
	totalCount: number;
	search: BrowseSearchParams;
}

export function MobileBrowseControls({
	category,
	browseTo,
	totalCount,
	search,
}: MobileBrowseControlsProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const { current, options } = getSortState(search);
	const menu = useDropdownMenu(options.length);

	function applySort(value: SortOption) {
		navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, sort: value, cursor: undefined }),
			replace: true,
		});
		menu.closeMenu();
	}

	return (
		<div className="md:hidden">
			<div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
				{BROWSE_CATEGORIES.map((c) => {
					const isActive = c.value === category;
					return (
						<Link
							key={c.value}
							to={c.to}
							data-testid={`browse-category-chip-${c.value}`}
							aria-current={isActive ? "page" : undefined}
							className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
								isActive
									? "bg-primary text-white"
									: "border border-border bg-background text-foreground"
							}`}
						>
							{t(`browse.categoryChips.${c.value}`)}
						</Link>
					);
				})}
			</div>
			<div className="flex items-center justify-between px-4 pb-1">
				<p
					data-testid="listings-result-count-mobile"
					aria-live="polite"
					className="text-xs text-muted"
				>
					<span data-testid="listings-total-count-mobile" className="font-semibold text-foreground">
						{totalCount}
					</span>{" "}
					{t("browse.resultCountWord")}
				</p>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler */}
				<div ref={menu.wrapperRef} className="relative" onBlur={menu.handleBlur}>
					<button
						type="button"
						data-testid="listings-sort-chip"
						aria-haspopup="menu"
						aria-expanded={menu.open}
						onClick={menu.toggle}
						onKeyDown={menu.handleButtonKeyDown}
						className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground"
					>
						<ArrowDownUp className="h-3.5 w-3.5 text-muted" />
						{current.label}
						<ChevronDown className="h-3.5 w-3.5 text-muted" />
					</button>
					{menu.open ? (
						<div
							role="menu"
							data-testid="listings-sort-menu"
							onKeyDown={menu.handleMenuKeyDown}
							className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-lg"
						>
							{options.map((s, i) => (
								<button
									key={s.value}
									type="button"
									role="menuitemradio"
									aria-checked={s.value === current.value}
									tabIndex={menu.focusIndex === i ? 0 : -1}
									ref={(el) => {
										menu.itemRefs.current[i] = el;
									}}
									data-testid={`listings-sort-option-${s.value}`}
									onClick={() => applySort(s.value)}
									className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light focus:bg-muted-light focus:outline-none"
								>
									{s.label}
									{s.value === current.value ? <Check className="h-4 w-4 text-accent" /> : null}
								</button>
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
