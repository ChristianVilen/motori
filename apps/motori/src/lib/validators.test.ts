import { describe, expect, it } from "vitest";
import {
	bookingRequestSchema,
	browseSearchSchema,
	countActiveFilters,
	isValidImageUrl,
	listingFormSchema,
	validateFinnishPhone,
} from "./validators";

describe("listingFormSchema", () => {
	it("requires make_id", () => {
		const result = listingFormSchema().safeParse({
			category: "rental",
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
			category: "rental",
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

	const validSale = {
		category: "sale",
		title: "Honda CBR650R hyväkuntoinen",
		make_id: "some-uuid",
		model_id: "model-uuid",
		year: 2020,
		motorcycle_type: "sport",
		condition: "good",
		km_driven: 12000,
		price: 7500,
		city: "Helsinki",
		region: "uusimaa",
		description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
	};

	it("accepts a valid sale listing", () => {
		expect(listingFormSchema().safeParse(validSale).success).toBe(true);
	});

	it("requires km_driven for sale", () => {
		for (const km_driven of [undefined, null]) {
			const result = listingFormSchema().safeParse({ ...validSale, km_driven });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes("km_driven"))).toBe(true);
			}
		}
	});

	it("requires model_id for sale", () => {
		for (const model_id of [undefined, null, ""]) {
			const result = listingFormSchema().safeParse({ ...validSale, model_id });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes("model_id"))).toBe(true);
			}
		}
	});

	it("accepts sale detail fields", () => {
		const result = listingFormSchema().safeParse({
			...validSale,
			color: "punainen/musta",
			owner_count: 2,
			power_kw: 70,
			trade_possible: true,
		});
		expect(result.success).toBe(true);
	});

	it("defaults trade_possible to false", () => {
		const result = listingFormSchema().safeParse(validSale);
		expect(result.success).toBe(true);
		if (result.success && result.data.category === "sale") {
			expect(result.data.trade_possible).toBe(false);
		}
	});

	it("rejects out-of-bounds sale detail fields", () => {
		expect(listingFormSchema().safeParse({ ...validSale, owner_count: 0 }).success).toBe(false);
		expect(listingFormSchema().safeParse({ ...validSale, owner_count: 100 }).success).toBe(false);
		expect(listingFormSchema().safeParse({ ...validSale, power_kw: 0 }).success).toBe(false);
		expect(listingFormSchema().safeParse({ ...validSale, power_kw: 501 }).success).toBe(false);
		expect(listingFormSchema().safeParse({ ...validSale, color: "x".repeat(31) }).success).toBe(
			false,
		);
	});

	const validGear = {
		category: "gear",
		title: "Shoei NXR2 kypärä myynnissä",
		gear_type: "helmet",
		condition: "good",
		price: 300,
		city: "Helsinki",
		region: "uusimaa",
		description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
	};

	it("accepts gear size from the enum and null", () => {
		expect(listingFormSchema().safeParse({ ...validGear, size: "M" }).success).toBe(true);
		expect(listingFormSchema().safeParse({ ...validGear, size: "muu" }).success).toBe(true);
		expect(listingFormSchema().safeParse({ ...validGear, size: null }).success).toBe(true);
		expect(listingFormSchema().safeParse(validGear).success).toBe(true);
	});

	it("rejects gear size outside the enum", () => {
		expect(listingFormSchema().safeParse({ ...validGear, size: "medium" }).success).toBe(false);
		expect(listingFormSchema().safeParse({ ...validGear, size: "57-58cm" }).success).toBe(false);
	});

	it("accepts optional gear brand within bounds", () => {
		expect(listingFormSchema().safeParse({ ...validGear, brand: "Shoei" }).success).toBe(true);
		expect(listingFormSchema().safeParse({ ...validGear, brand: "x".repeat(51) }).success).toBe(
			false,
		);
	});

	const validPart = {
		category: "part",
		title: "CBR650R jarrulevyt eteen",
		part_category: "brakes",
		condition: "good",
		price: 120,
		city: "Helsinki",
		region: "uusimaa",
		description: "Tämä on kuvaus joka on tarpeeksi pitkä validointia varten",
	};

	it("accepts optional part oem_number within bounds", () => {
		expect(
			listingFormSchema().safeParse({ ...validPart, oem_number: "45251-MKN-D51" }).success,
		).toBe(true);
		expect(
			listingFormSchema().safeParse({ ...validPart, oem_number: "x".repeat(51) }).success,
		).toBe(false);
	});

	it("accepts compatible_model_id for parts", () => {
		expect(
			listingFormSchema().safeParse({
				...validPart,
				compatible_make_id: "make-uuid",
				compatible_model_id: "model-uuid",
			}).success,
		).toBe(true);
		expect(listingFormSchema().safeParse({ ...validPart, compatible_model_id: null }).success).toBe(
			true,
		);
	});
});

describe("isValidImageUrl", () => {
	it("accepts local upload paths", () => {
		expect(isValidImageUrl("/api/uploads/abc.webp")).toBe(true);
	});

	it("rejects arbitrary URLs when STORAGE_PUBLIC_URL is not set", () => {
		delete process.env.STORAGE_PUBLIC_URL;
		expect(isValidImageUrl("https://evil.com/image.webp")).toBe(false);
	});

	it("accepts URLs matching STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi";
		expect(isValidImageUrl("https://storage.motori.fi/images/abc.webp")).toBe(true);
		delete process.env.STORAGE_PUBLIC_URL;
	});

	it("rejects URLs not matching STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi";
		expect(isValidImageUrl("https://evil.com/image.webp")).toBe(false);
		delete process.env.STORAGE_PUBLIC_URL;
	});

	it("rejects empty string", () => {
		expect(isValidImageUrl("")).toBe(false);
	});
});

describe("validateFinnishPhone", () => {
	it("accepts valid +358 numbers", () => {
		expect(validateFinnishPhone("+358401234567")).toBe("+358401234567");
	});

	it("accepts valid 0-prefixed numbers", () => {
		expect(validateFinnishPhone("0401234567")).toBe("0401234567");
	});

	it("accepts numbers with spaces and dashes", () => {
		expect(validateFinnishPhone("040-123 4567")).toBe("040-123 4567");
	});

	it("trims whitespace", () => {
		expect(validateFinnishPhone("  0401234567  ")).toBe("0401234567");
	});

	it("allows empty string (optional field)", () => {
		expect(validateFinnishPhone("")).toBe("");
	});

	it("throws on invalid format", () => {
		expect(() => validateFinnishPhone("12345")).toThrow();
	});

	it("throws with custom error message", () => {
		expect(() => validateFinnishPhone("abc", "Custom error")).toThrow("Custom error");
	});
});

describe("browseSearchSchema", () => {
	it("accepts empty object", () => {
		expect(browseSearchSchema.safeParse({}).success).toBe(true);
	});

	it("accepts valid part_category", () => {
		expect(browseSearchSchema.safeParse({ part_category: "brakes" }).success).toBe(true);
	});

	it("rejects unknown part_category", () => {
		expect(browseSearchSchema.safeParse({ part_category: "wheels" }).success).toBe(false);
	});

	it("accepts valid size", () => {
		expect(browseSearchSchema.safeParse({ size: "M" }).success).toBe(true);
	});

	it("rejects unknown size", () => {
		expect(browseSearchSchema.safeParse({ size: "XXXL" }).success).toBe(false);
	});

	it("accepts valid km_max", () => {
		expect(browseSearchSchema.safeParse({ km_max: 50000 }).success).toBe(true);
	});

	it("rejects negative km_max", () => {
		expect(browseSearchSchema.safeParse({ km_max: -1 }).success).toBe(false);
	});
});

describe("countActiveFilters", () => {
	it("returns 0 for empty search", () => {
		expect(countActiveFilters({})).toBe(0);
	});

	it("counts each motorcycle filter", () => {
		expect(
			countActiveFilters({
				region: "uusimaa",
				type: ["naked", "sport"],
				license: ["A"],
				price_min: 10,
				price_max: 100,
				cc_min: 125,
				cc_max: 600,
				year_min: 2015,
				year_max: 2023,
				make: "honda",
			}),
		).toBe(11);
	});

	it("counts new category-specific filters", () => {
		expect(
			countActiveFilters({
				gear_type: "helmet",
				condition: "good",
				part_category: "brakes",
				size: "L",
				km_max: 30000,
			}),
		).toBe(5);
	});

	it("does not count undefined optional fields", () => {
		expect(countActiveFilters({ region: undefined, type: undefined })).toBe(0);
	});
});

describe("bookingRequestSchema", () => {
	const validInput = {
		listing_id: "550e8400-e29b-41d4-a716-446655440000",
		start_date: "2027-06-01",
		end_date: "2027-06-03",
		message: "Haluaisin vuokrata pyörän",
	};

	it("accepts valid input", () => {
		expect(bookingRequestSchema.safeParse(validInput).success).toBe(true);
	});

	it("rejects invalid UUID", () => {
		const result = bookingRequestSchema.safeParse({ ...validInput, listing_id: "not-a-uuid" });
		expect(result.success).toBe(false);
	});

	it("rejects end_date before start_date", () => {
		const result = bookingRequestSchema.safeParse({
			...validInput,
			start_date: "2027-06-05",
			end_date: "2027-06-03",
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty message", () => {
		const result = bookingRequestSchema.safeParse({ ...validInput, message: "" });
		expect(result.success).toBe(false);
	});

	it("rejects message over 500 chars", () => {
		const result = bookingRequestSchema.safeParse({ ...validInput, message: "x".repeat(501) });
		expect(result.success).toBe(false);
	});

	it("rejects invalid date format", () => {
		const result = bookingRequestSchema.safeParse({ ...validInput, start_date: "not-a-date" });
		expect(result.success).toBe(false);
	});
});
