import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { getSortState, type SortOption } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import { useTranslation } from "~/lib/i18n";
import type { BrowseSearchParams } from "~/lib/validators";

interface MobileBrowseControlsProps {
	category: ListingCategory;
	browseTo: string;
	totalCount: number;
	search: BrowseSearchParams;
}

const CATEGORY_CHIPS = [
	{ value: "sale", to: "/pyorat/myynti", labelKey: "browse.categoryChips.sale" },
	{ value: "gear", to: "/varusteet", labelKey: "browse.categoryChips.gear" },
	{ value: "part", to: "/varaosat", labelKey: "browse.categoryChips.part" },
	{ value: "rental", to: "/pyorat/vuokraus", labelKey: "browse.categoryChips.rental" },
] as const;

export function MobileBrowseControls({
	category,
	browseTo,
	totalCount,
	search,
}: MobileBrowseControlsProps) {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(-1);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const { current: currentSort, options: sortOptions } = getSortState(search);
	const sortLabel = sortOptions.find((s) => s.value === currentSort)?.label ?? sortOptions[0].label;

	function handleBlur(e: React.FocusEvent) {
		if (!wrapperRef.current?.contains(e.relatedTarget as Node)) {
			setOpen(false);
		}
	}

	const openMenu = useCallback(() => {
		setOpen(true);
		setFocusIndex(0);
		requestAnimationFrame(() => itemRefs.current[0]?.focus());
	}, []);

	function closeMenu() {
		setOpen(false);
		wrapperRef.current?.querySelector("button")?.focus();
	}

	function handleButtonKeyDown(e: React.KeyboardEvent) {
		if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openMenu();
		}
	}

	function handleMenuKeyDown(e: React.KeyboardEvent) {
		switch (e.key) {
			case "Escape":
				e.preventDefault();
				closeMenu();
				break;
			case "ArrowDown":
				e.preventDefault();
				setFocusIndex((i) => {
					const next = Math.min(i + 1, sortOptions.length - 1);
					itemRefs.current[next]?.focus();
					return next;
				});
				break;
			case "ArrowUp":
				e.preventDefault();
				setFocusIndex((i) => {
					const next = Math.max(i - 1, 0);
					itemRefs.current[next]?.focus();
					return next;
				});
				break;
			case "Home":
				e.preventDefault();
				setFocusIndex(0);
				itemRefs.current[0]?.focus();
				break;
			case "End":
				e.preventDefault();
				setFocusIndex(sortOptions.length - 1);
				itemRefs.current[sortOptions.length - 1]?.focus();
				break;
		}
	}

	function applySort(value: SortOption) {
		navigate({
			to: browseTo,
			search: (prev) => ({ ...prev, sort: value, cursor: undefined }),
			replace: true,
		});
		closeMenu();
	}

	return (
		<div className="md:hidden">
			<div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
				{CATEGORY_CHIPS.map((chip) => {
					const isActive = chip.value === category;
					return (
						<Link
							key={chip.value}
							to={chip.to}
							data-testid={`browse-category-chip-${chip.value}`}
							aria-current={isActive ? "page" : undefined}
							className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
								isActive
									? "bg-primary text-white"
									: "border border-border bg-background text-foreground"
							}`}
						>
							{t(chip.labelKey)}
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
				<div ref={wrapperRef} className="relative" onBlur={handleBlur}>
					<button
						type="button"
						data-testid="listings-sort-chip"
						aria-haspopup="menu"
						aria-expanded={open}
						onClick={() => (open ? setOpen(false) : openMenu())}
						onKeyDown={handleButtonKeyDown}
						className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground"
					>
						<ArrowDownUp className="h-3.5 w-3.5 text-muted" />
						{sortLabel}
						<ChevronDown className="h-3.5 w-3.5 text-muted" />
					</button>
					{open ? (
						<div
							role="menu"
							data-testid="listings-sort-menu"
							onKeyDown={handleMenuKeyDown}
							className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-lg"
						>
							{sortOptions.map((s, i) => (
								<button
									key={s.value}
									type="button"
									role="menuitemradio"
									aria-checked={s.value === currentSort}
									tabIndex={focusIndex === i ? 0 : -1}
									ref={(el) => {
										itemRefs.current[i] = el;
									}}
									data-testid={`listings-sort-option-${s.value}`}
									onClick={() => applySort(s.value)}
									className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light focus:bg-muted-light focus:outline-none"
								>
									{s.label}
									{s.value === currentSort ? <Check className="h-4 w-4 text-accent" /> : null}
								</button>
							))}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
