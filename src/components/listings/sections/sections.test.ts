import { describe, expect, it } from "vitest";
import { gearSection } from "./section-gear";
import { partSection } from "./section-part";
import { rentalSection } from "./section-rental";
import { saleSection } from "./section-sale";
import type { SharedPayload } from "./types";

const shared: SharedPayload = {
	title: "T",
	city: "Helsinki",
	region: "uusimaa",
	postal_code: null,
	description: "D".repeat(30),
	images: [],
};

describe("rentalSection", () => {
	it("defaults are empty when initial is missing or wrong category", () => {
		expect(rentalSection.defaultValues(undefined).price_per_day).toBe("");
		expect(
			rentalSection.defaultValues({ category: "sale", price: 1 } as never).make_id,
		).toBe("");
	});

	it("hydrates defaults from a rental initial value", () => {
		const v = rentalSection.defaultValues({
			category: "rental",
			make_id: "m1",
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
		} as never);
		expect(v.make_id).toBe("m1");
		expect(v.year).toBe(2020);
		expect(v.price_per_day).toBe(50);
	});

	it("toPayload produces the rental discriminated branch", () => {
		const value = rentalSection.defaultValues({
			category: "rental",
			make_id: "m1",
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
		} as never);
		const payload = rentalSection.toPayload(shared, value);
		expect(payload.category).toBe("rental");
		expect(payload.title).toBe("T");
		expect(payload.price_per_day).toBe(50);
		expect(payload.images).toEqual([]);
	});
});

describe("saleSection", () => {
	it("hydrates defaults and toPayload preserves discriminated branch", () => {
		const v = saleSection.defaultValues({
			category: "sale",
			make_id: "m1",
			year: 2019,
			motorcycle_type: "sport",
			price: 800000,
			condition: "good",
			km_driven: 12000,
			negotiable: true,
		} as never);
		const payload = saleSection.toPayload(shared, v);
		expect(payload.category).toBe("sale");
		expect(payload.price).toBe(800000);
		expect(payload.condition).toBe("good");
		expect(payload.km_driven).toBe(12000);
		expect(payload.negotiable).toBe(true);
	});
});

describe("gearSection", () => {
	it("ignores initial values from the wrong category", () => {
		const v = gearSection.defaultValues({ category: "rental", make_id: "m1" } as never);
		expect(v.gear_gear_type).toBe("");
		expect(v.gear_price).toBe("");
	});

	it("toPayload produces gear discriminated branch", () => {
		const v = gearSection.defaultValues({
			category: "gear",
			gear_type: "helmet",
			size: "M",
			condition: "excellent",
			price: 25000,
		} as never);
		const payload = gearSection.toPayload(shared, v);
		expect(payload.category).toBe("gear");
		expect(payload.gear_type).toBe("helmet");
		expect(payload.size).toBe("M");
		expect(payload.price).toBe(25000);
	});
});

describe("partSection", () => {
	it("toPayload produces part discriminated branch", () => {
		const v = partSection.defaultValues({
			category: "part",
			part_category: "Jarrulevyt",
			condition: "good",
			price: 8000,
			compatible_make_id: null,
		} as never);
		const payload = partSection.toPayload(shared, v);
		expect(payload.category).toBe("part");
		expect(payload.part_category).toBe("Jarrulevyt");
		expect(payload.condition).toBe("good");
	});
});

describe("section field keys are unique per section", () => {
	it("rental keys are disjoint from sale keys (except shared motorcycle keys)", () => {
		const rentalOnly = new Set(rentalSection.fieldKeys);
		const saleOnly = new Set(saleSection.fieldKeys);
		// rental_price_per_day not in sale, sale_price not in rental
		expect(rentalOnly.has("price_per_day" as never)).toBe(true);
		expect(saleOnly.has("price_per_day" as never)).toBe(false);
		expect(saleOnly.has("sale_price" as never)).toBe(true);
		expect(rentalOnly.has("sale_price" as never)).toBe(false);
	});
});
