import { describe, expect, it } from "vitest";
import { listingFormSchema } from "./validators";

describe("listingFormSchema", () => {
	it("requires make_id", () => {
		const result = listingFormSchema().safeParse({
			title: "Testi pyörä jolla on pitkä nimi",
			make_id: "",
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
			city: "Helsinki",
			region: "uusimaa",
			description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes("make_id"))).toBe(true);
		}
	});

	it("accepts null model_id", () => {
		const result = listingFormSchema().safeParse({
			title: "Testi pyörä jolla on pitkä nimi",
			make_id: "some-uuid",
			model_id: null,
			year: 2020,
			motorcycle_type: "naked",
			price_per_day: 50,
			city: "Helsinki",
			region: "uusimaa",
			description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
		});
		expect(result.success).toBe(true);
	});
});
