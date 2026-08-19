import { describe, expect, it } from "vitest";
import { savedSearchLabel } from "./saved-search-label";

const makes = [
	{ id: "1", slug: "honda", name: "Honda" },
	{ id: "2", slug: "yamaha", name: "Yamaha" },
];

describe("savedSearchLabel", () => {
	it("builds the decision's example shape (category · make · region · price)", () => {
		const label = savedSearchLabel(
			"sale",
			{ make: "honda", region: "uusimaa", price_max: 6000 },
			makes,
		);
		expect(label).toBe("Myynti · Honda · Uusimaa · Max 6000€");
	});

	it("includes the free-text query as-is, right after the category", () => {
		const label = savedSearchLabel("sale", { q: "cb500" }, makes);
		expect(label).toBe("Myynti · cb500");
	});

	it("falls back to the raw slug for an unknown make", () => {
		const label = savedSearchLabel("sale", { make: "ducati" }, makes);
		expect(label).toBe("Myynti · ducati");
	});

	it("returns just the category name for empty params", () => {
		expect(savedSearchLabel("sale", {}, makes)).toBe("Myynti");
		expect(savedSearchLabel("rental", {}, makes)).toBe("Vuokraus");
		expect(savedSearchLabel("gear", {}, makes)).toBe("Varusteet");
		expect(savedSearchLabel("part", {}, makes)).toBe("Varaosat");
	});

	it("renders gear params with Finnish labels", () => {
		const label = savedSearchLabel(
			"gear",
			{ gear_type: "helmet", size: "M", condition: "good" },
			makes,
		);
		expect(label).toBe("Varusteet · Hyvä · Kypärä · M");
	});

	it("renders part category via the constants lookup", () => {
		const label = savedSearchLabel("part", { part_category: "brakes" }, makes);
		expect(label).toBe("Varaosat · Jarrut");
	});

	it("renders type and license array filters", () => {
		const label = savedSearchLabel(
			"sale",
			{ type: ["naked", "sport"], license: ["A1", "A2"] },
			makes,
		);
		expect(label).toBe("Myynti · Naked · Sport · A1 · A2");
	});

	it("renders cc, year and km ranges in the chips' min/max style", () => {
		const label = savedSearchLabel(
			"sale",
			{ cc_min: 500, cc_max: 1000, year_min: 2015, year_max: 2020, km_max: 30000 },
			makes,
		);
		expect(label).toBe("Myynti · ≥500cc · ≤1000cc · ≥2015 · ≤2020 · ≤30000km");
	});

	it("ignores sort and cursor-ish keys", () => {
		const label = savedSearchLabel("sale", { make: "honda", sort: "price_asc" }, makes);
		expect(label).toBe("Myynti · Honda");
	});

	it("orders q, make, region ahead of the remaining filters", () => {
		const label = savedSearchLabel(
			"sale",
			{ price_min: 1000, make: "honda", q: "hyvä kunto", region: "pirkanmaa" },
			makes,
		);
		expect(label).toBe("Myynti · hyvä kunto · Honda · Pirkanmaa · Min 1000€");
	});
});
