import {
	CONDITION_LABELS,
	GEAR_TYPE_LABELS,
	MOTORCYCLE_TYPES,
	PART_CATEGORIES,
	REGIONS,
} from "~/lib/constants";
import type { ListingCategory } from "~/lib/db/schema";
import type { SavedSearchParams } from "~/lib/validators";

// Not the mobile-search-overlay category map (components/nav/mobile-search-overlay.tsx:10-15) —
// that one is keyed "parts", this domain type is keyed "part".
const CATEGORY_LABELS: Record<ListingCategory, string> = {
	sale: "Myynti",
	rental: "Vuokraus",
	gear: "Varusteet",
	part: "Varaosat",
};

interface MakeLookup {
	slug: string;
	name: string;
}

// Mirrors the human-readable renderings in ActiveFilterChips
// (components/listings/filter-sidebar.tsx:64-167) — same lookups, same number
// formatting — so a saved search reads like the filter chips it was saved from.
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parts list grows with supported filter fields, same shape as ActiveFilterChips
export function savedSearchLabel(
	category: ListingCategory,
	params: SavedSearchParams,
	makes: MakeLookup[],
): string {
	const parts: string[] = [CATEGORY_LABELS[category]];

	if (params.q) {
		parts.push(params.q);
	}
	if (params.make) {
		parts.push(makes.find((m) => m.slug === params.make)?.name ?? params.make);
	}
	if (params.region) {
		parts.push(REGIONS.find((r) => r.value === params.region)?.label ?? params.region);
	}
	for (const typeVal of params.type ?? []) {
		parts.push(MOTORCYCLE_TYPES.find((mt) => mt.value === typeVal)?.label ?? typeVal);
	}
	for (const license of params.license ?? []) {
		parts.push(license);
	}
	if (params.price_min != null) {
		parts.push(`Min ${params.price_min}€`);
	}
	if (params.price_max != null) {
		parts.push(`Max ${params.price_max}€`);
	}
	if (params.cc_min != null) {
		parts.push(`≥${params.cc_min}cc`);
	}
	if (params.cc_max != null) {
		parts.push(`≤${params.cc_max}cc`);
	}
	if (params.year_min != null) {
		parts.push(`≥${params.year_min}`);
	}
	if (params.year_max != null) {
		parts.push(`≤${params.year_max}`);
	}
	if (params.condition) {
		parts.push(CONDITION_LABELS[params.condition]);
	}
	if (params.gear_type) {
		parts.push(GEAR_TYPE_LABELS[params.gear_type]);
	}
	if (params.size) {
		parts.push(params.size);
	}
	if (params.part_category) {
		parts.push(
			PART_CATEGORIES.find((c) => c.value === params.part_category)?.label ?? params.part_category,
		);
	}
	if (params.km_max != null) {
		parts.push(`≤${params.km_max}km`);
	}

	return parts.join(" · ");
}
