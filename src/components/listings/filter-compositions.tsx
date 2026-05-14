import {
	CcFilter,
	ConditionFilter,
	GearTypeFilter,
	KmMaxFilter,
	LicenseFilter,
	MakeFilter,
	PartCategoryFilter,
	PriceFilter,
	RegionFilter,
	SizeFilter,
	SortFilter,
	TypeFilter,
	YearFilter,
} from "./filter-controls";

export function RentalFilters() {
	return (
		<>
			<RegionFilter />
			<TypeFilter />
			<LicenseFilter />
			<PriceFilter />
			<MakeFilter />
			<CcFilter />
			<YearFilter />
			<SortFilter />
		</>
	);
}

export function SaleFilters() {
	return (
		<>
			<RegionFilter />
			<TypeFilter />
			<PriceFilter labelKey="filters.price" />
			<MakeFilter />
			<YearFilter />
			<CcFilter />
			<ConditionFilter />
			<KmMaxFilter />
			<SortFilter />
		</>
	);
}

export function PartsFilters() {
	return (
		<>
			<RegionFilter />
			<PartCategoryFilter />
			<MakeFilter />
			<ConditionFilter />
			<PriceFilter labelKey="filters.price" />
			<SortFilter />
		</>
	);
}

export function GearFilters() {
	return (
		<>
			<RegionFilter />
			<GearTypeFilter />
			<SizeFilter />
			<ConditionFilter />
			<PriceFilter labelKey="filters.price" />
			<SortFilter />
		</>
	);
}
