import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowDownUp,
	Check,
	ChevronDown,
	List,
	Map as MapIcon,
	SlidersHorizontal,
} from "lucide-react";
import {
	BROWSE_CATEGORIES,
	type BrowseCategory,
	getSortState,
	type SortOption,
} from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";
import { useDropdownMenu } from "../use-dropdown-menu";

const toolChip =
	"inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-muted-light";
export function FeedBar({
	category,
	browseTo,
	search,
	showMap,
	filterCount,
	onFilter,
}: {
	category: BrowseCategory["value"];
	browseTo: string;
	search: BrowseSearchParams;
	showMap: boolean;
	filterCount: number;
	onFilter: () => void;
}) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const { current, options } = getSortState(search, category === "all" ? "newest" : "relevance");
	const menu = useDropdownMenu(options.length);
	function applySort(value: SortOption) {
		void navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, sort: value, cursor: undefined }),
			replace: true,
		});
		menu.closeMenu();
	}
	const map = search.view === "map";
	return (
		<div className="sticky top-(--browse-sticky-top) z-10 bg-background">
			<div className="mx-auto flex max-w-[1304px] flex-wrap items-center gap-2 px-4 pt-2 pb-2.5 lg:px-8 min-[900px]:flex-nowrap">
				<nav
					className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 gap-1.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] min-[900px]:mx-0 min-[900px]:w-auto min-[900px]:overflow-visible min-[900px]:px-0"
					aria-label={t("common:nav.search.categories")}
				>
					{BROWSE_CATEGORIES.map((c) => (
						<Link
							key={c.to}
							to={c.to}
							data-testid={`browse-category-chip-${c.value}`}
							search={{ q: search.q, region: search.region }}
							aria-current={category === c.value ? "page" : undefined}
							className={`${toolChip} px-4 aria-[current=page]:border-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground`}
						>
							{t(`browse.categoryChips.${c.value}`)}
						</Link>
					))}
				</nav>
				<span
					aria-hidden="true"
					className="mx-1 hidden h-6 border-l border-border min-[900px]:block"
				/>
				<button
					type="button"
					data-testid="listings-filter-drawer-toggle"
					aria-haspopup="dialog"
					aria-label={t("browse.filterButtonAriaLabel")}
					onClick={(event) => {
						event.currentTarget.focus({ preventScroll: true });
						onFilter();
					}}
					className={toolChip}
				>
					<SlidersHorizontal size={16} />
					{t("browse.filter")}
					{filterCount > 0 && (
						<span className="rounded-full bg-reflector px-1.5 text-xs font-bold text-foreground">
							{filterCount}
						</span>
					)}
				</button>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: dropdown wrapper needs blur handler */}
				<div
					ref={menu.wrapperRef}
					className={showMap ? "relative min-w-0 max-sm:flex-1" : "relative"}
					onBlur={menu.handleBlur}
				>
					<button
						type="button"
						data-testid="listings-sort-chip"
						aria-haspopup="menu"
						aria-expanded={menu.open}
						onClick={menu.toggle}
						onKeyDown={menu.handleButtonKeyDown}
						className={`${toolChip} max-w-full`}
					>
						<ArrowDownUp
							className={
								showMap
									? "hidden size-3.5 shrink-0 text-muted sm:block"
									: "size-3.5 shrink-0 text-muted"
							}
						/>
						<span className="truncate">{t(`filters.sortOptions.${current.value}`)}</span>
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
									{t(`filters.sortOptions.${s.value}`)}
									{s.value === current.value ? <Check className="h-4 w-4 text-foreground" /> : null}
								</button>
							))}
						</div>
					) : null}
				</div>
				{showMap ? (
					<div className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-card p-[3px]">
						{(["list", "map"] as const).map((view) => {
							const active = (view === "map") === map;
							const Icon = view === "list" ? List : MapIcon;
							return (
								<button
									key={view}
									type="button"
									aria-pressed={active}
									data-testid={active ? undefined : "listings-view-toggle"}
									onClick={() => {
										if (!active) {
											void navigate({
												to: browseTo,
												search: (prev) => ({
													...prev,
													view: view === "map" ? "map" : undefined,
													city: undefined,
													cursor: undefined,
												}),
											});
										}
									}}
									className="inline-flex h-full items-center gap-1 rounded-full px-2 text-sm font-medium aria-pressed:bg-primary aria-pressed:text-primary-foreground"
								>
									<Icon size={15} className="hidden sm:block" />
									{t(view === "list" ? "browse.listToggle" : "browse.mapToggle")}
								</button>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);
}
