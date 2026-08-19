/**
 * PROTOTYPE — ticket #171 (map #164). THROWAWAY, dev-only, delete after the decision.
 *
 * Three variants of the mobile category-switch + sort affordance, rendered on the
 * existing browse routes inside BrowsePage and switched via ?variant=A|B|C:
 *   A — scrollable category chip row + sort chip with inline menu
 *   B — segmented control attached to the search header + compact sort select
 *   C — sticky results toolbar; category title and sort each open a bottom sheet
 *
 * Every variant also previews the bottom-nav "Selaa" highlight (injected style).
 * The `variant` param is not part of browseSearchSchema (Zod strips it from
 * router-managed search), so navigation here uses plain location changes.
 */
import { ArrowDownUp, Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ClientOnly } from "~/components/client-only";
import { SORT_OPTIONS, type SortOption } from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import type { BrowseSearchParams } from "~/lib/validators";

const VARIANTS = ["A", "B", "C"] as const;
type Variant = (typeof VARIANTS)[number];

const VARIANT_NAMES: Record<Variant, string> = {
	A: "Chip row",
	B: "Segmented header",
	C: "Toolbar + sheets",
};

const CATEGORIES: {
	value: ListingCategory;
	label: string;
	titleLabel: string;
	path: string;
}[] = [
	{ value: "sale", label: "Pyörät", titleLabel: "Moottoripyörät", path: "/pyorat/myynti" },
	{ value: "gear", label: "Varusteet", titleLabel: "Varusteet", path: "/varusteet" },
	{ value: "part", label: "Varaosat", titleLabel: "Varaosat", path: "/varaosat" },
	{ value: "rental", label: "Vuokraus", titleLabel: "Vuokrapyörät", path: "/pyorat/vuokraus" },
];

type Props = {
	category: ListingCategory;
	search: BrowseSearchParams;
	totalCount: number;
};

export function Prototype171MobileCategorySort(props: Props) {
	if (import.meta.env.PROD) {
		return null;
	}
	return (
		<ClientOnly>
			<PrototypeInner {...props} />
		</ClientOnly>
	);
}

function readVariant(): Variant | null {
	const v = new URLSearchParams(window.location.search).get("variant");
	return (VARIANTS as readonly string[]).includes(v ?? "") ? (v as Variant) : null;
}

function applySort(sort: SortOption) {
	const params = new URLSearchParams(window.location.search);
	params.set("sort", sort);
	params.delete("cursor");
	window.location.search = params.toString();
}

function PrototypeInner({ category, search, totalCount }: Props) {
	const [variant, setVariantState] = useState<Variant | null>(readVariant);

	const setVariant = useCallback((v: Variant | null) => {
		const params = new URLSearchParams(window.location.search);
		if (v) {
			params.set("variant", v);
		} else {
			params.delete("variant");
		}
		const qs = params.toString();
		window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
		setVariantState(v);
	}, []);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!variant) {
				return;
			}
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
				return;
			}
			const i = VARIANTS.indexOf(variant);
			if (e.key === "ArrowLeft") {
				setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length]);
			} else if (e.key === "ArrowRight") {
				setVariant(VARIANTS[(i + 1) % VARIANTS.length]);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [variant, setVariant]);

	if (!variant) {
		return null;
	}

	const hasQuery = !!search.q && search.q.trim().length > 0;
	const currentSort: SortOption = search.sort ?? (hasQuery ? "relevance" : "newest");
	const sortOptions = SORT_OPTIONS.filter((s) => s.value !== "relevance" || hasQuery);
	const sortLabel = SORT_OPTIONS.find((s) => s.value === currentSort)?.label ?? "";
	const i = VARIANTS.indexOf(variant);

	return (
		<>
			{/* Preview of the bottom-nav browse highlight — common to all variants */}
			<style>{`[data-testid="bottom-nav-browse"] { color: var(--color-accent); }`}</style>

			{variant === "A" && (
				<VariantChipRow
					category={category}
					totalCount={totalCount}
					currentSort={currentSort}
					sortLabel={sortLabel}
					sortOptions={sortOptions}
				/>
			)}
			{variant === "B" && (
				<VariantSegmented
					category={category}
					totalCount={totalCount}
					currentSort={currentSort}
					sortOptions={sortOptions}
				/>
			)}
			{variant === "C" && (
				<VariantToolbarSheets
					category={category}
					currentSort={currentSort}
					sortLabel={sortLabel}
					sortOptions={sortOptions}
				/>
			)}

			{/* Floating variant switcher — dev tooling, not part of the design */}
			<div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center md:bottom-6">
				<div className="flex items-center gap-0.5 rounded-full bg-fuchsia-700 px-2 py-1.5 text-white shadow-lg">
					<button
						type="button"
						onClick={() => setVariant(VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length])}
						aria-label="Previous variant"
						className="rounded-full p-1 hover:bg-white/20"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<span className="px-1 text-xs font-semibold">
						{variant} — {VARIANT_NAMES[variant]}
					</span>
					<button
						type="button"
						onClick={() => setVariant(VARIANTS[(i + 1) % VARIANTS.length])}
						aria-label="Next variant"
						className="rounded-full p-1 hover:bg-white/20"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
					<button
						type="button"
						onClick={() => setVariant(null)}
						aria-label="Close prototype"
						className="ml-1 rounded-full p-1 hover:bg-white/20"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		</>
	);
}

/* ---------- Variant A — chip row + sort chip with inline menu ---------- */

function VariantChipRow({
	category,
	totalCount,
	currentSort,
	sortLabel,
	sortOptions,
}: {
	category: ListingCategory;
	totalCount: number;
	currentSort: SortOption;
	sortLabel: string;
	sortOptions: { value: SortOption; label: string }[];
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	return (
		<div className="md:hidden">
			<div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
				{CATEGORIES.map((c) => (
					<a
						key={c.value}
						href={`${c.path}?variant=A`}
						className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
							c.value === category
								? "bg-primary text-white"
								: "border border-border bg-background text-foreground"
						}`}
					>
						{c.label}
					</a>
				))}
			</div>
			<div className="flex items-center justify-between px-4 pb-1">
				<span className="text-xs text-muted">{totalCount} ilmoitusta</span>
				<div className="relative">
					<button
						type="button"
						onClick={() => setMenuOpen((o) => !o)}
						className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-foreground"
					>
						<ArrowDownUp className="h-3.5 w-3.5 text-muted" />
						{sortLabel}
						<ChevronDown className="h-3.5 w-3.5 text-muted" />
					</button>
					{menuOpen ? (
						<>
							<button
								type="button"
								aria-label="Sulje"
								onClick={() => setMenuOpen(false)}
								className="fixed inset-0 z-40 cursor-default"
							/>
							<div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-background py-1 shadow-lg">
								{sortOptions.map((s) => (
									<button
										key={s.value}
										type="button"
										onClick={() => applySort(s.value)}
										className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{s.label}
										{s.value === currentSort && <Check className="h-4 w-4 text-accent" />}
									</button>
								))}
							</div>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}

/* ---------- Variant B — segmented control in the header + inline select ---------- */

function VariantSegmented({
	category,
	totalCount,
	currentSort,
	sortOptions,
}: {
	category: ListingCategory;
	totalCount: number;
	currentSort: SortOption;
	sortOptions: { value: SortOption; label: string }[];
}) {
	return (
		<div className="md:hidden">
			<div className="bg-primary px-4 pb-3">
				<div className="flex rounded-lg bg-white/10 p-1">
					{CATEGORIES.filter((c) => c.value !== "rental").map((c) => (
						<a
							key={c.value}
							href={`${c.path}?variant=B`}
							className={`flex-1 rounded-md py-1.5 text-center text-sm font-medium ${
								c.value === category ? "bg-white text-primary" : "text-white/80"
							}`}
						>
							{c.label}
						</a>
					))}
				</div>
			</div>
			<div className="flex items-center justify-between px-4 py-2">
				<span className="text-xs text-muted">{totalCount} ilmoitusta</span>
				<label className="flex items-center gap-1.5 text-sm text-foreground">
					<ArrowDownUp className="h-4 w-4 text-muted" />
					<select
						value={currentSort}
						onChange={(e) => applySort(e.target.value as SortOption)}
						className="bg-transparent text-sm font-medium text-foreground focus:outline-none"
					>
						{sortOptions.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</label>
			</div>
		</div>
	);
}

/* ---------- Variant C — sticky toolbar, category + sort as bottom sheets ---------- */

function VariantToolbarSheets({
	category,
	currentSort,
	sortLabel,
	sortOptions,
}: {
	category: ListingCategory;
	currentSort: SortOption;
	sortLabel: string;
	sortOptions: { value: SortOption; label: string }[];
}) {
	const [sheet, setSheet] = useState<"category" | "sort" | null>(null);
	const active = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0];
	return (
		<div className="md:hidden">
			<div className="sticky top-0 z-30 border-b border-border bg-background">
				<div className="flex items-center justify-between px-4 py-2.5">
					<button
						type="button"
						onClick={() => setSheet("category")}
						className="flex items-center gap-1 text-base font-semibold text-foreground"
					>
						{active.titleLabel}
						<ChevronDown className="h-4 w-4 text-muted" />
					</button>
					<button
						type="button"
						onClick={() => setSheet("sort")}
						className="flex items-center gap-1.5 text-sm text-foreground"
					>
						<ArrowDownUp className="h-4 w-4 text-muted" />
						{sortLabel}
					</button>
				</div>
			</div>

			{sheet ? (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						aria-label="Sulje"
						onClick={() => setSheet(null)}
						className="absolute inset-0 bg-black/40"
					/>
					<div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
						<div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
						<h3 className="mb-2 text-sm font-semibold text-foreground">
							{sheet === "category" ? "Kategoria" : "Järjestä"}
						</h3>
						{sheet === "category"
							? CATEGORIES.map((c) => (
									<a
										key={c.value}
										href={`${c.path}?variant=C`}
										className="flex items-center justify-between rounded-lg px-2 py-3 text-sm text-foreground hover:bg-muted-light"
									>
										{c.titleLabel}
										{c.value === category && <Check className="h-4 w-4 text-accent" />}
									</a>
								))
							: sortOptions.map((s) => (
									<button
										key={s.value}
										type="button"
										onClick={() => applySort(s.value)}
										className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left text-sm text-foreground hover:bg-muted-light"
									>
										{s.label}
										{s.value === currentSort && <Check className="h-4 w-4 text-accent" />}
									</button>
								))}
					</div>
				</div>
			) : null}
		</div>
	);
}
