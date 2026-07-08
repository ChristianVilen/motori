import { describe, expect, it } from "vitest";
import { centsToEuros, eurosToCents } from "./currency";

describe("eurosToCents", () => {
	it("converts whole euros", () => {
		expect(eurosToCents(55)).toBe(5500);
	});

	it("converts fractional euros and rounds", () => {
		expect(eurosToCents(55.5)).toBe(5550);
		expect(eurosToCents(19.999)).toBe(2000);
	});

	it("handles zero", () => {
		expect(eurosToCents(0)).toBe(0);
	});
});

describe("centsToEuros", () => {
	it("converts whole cents", () => {
		expect(centsToEuros(5500)).toBe(55);
	});

	it("converts fractional cents", () => {
		expect(centsToEuros(5550)).toBe(55.5);
	});

	it("handles zero", () => {
		expect(centsToEuros(0)).toBe(0);
	});
});
