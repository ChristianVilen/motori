import { describe, expect, it } from "vitest";
import { formatPower, hvToKw, kwToHv, roundKw } from "./power";

describe("roundKw", () => {
	it("rounds to one decimal", () => {
		expect(roundKw(73.56)).toBe(73.6);
		expect(roundKw(73.54)).toBe(73.5);
	});

	it("keeps a whole number", () => {
		expect(roundKw(45)).toBe(45);
	});
});

describe("hvToKw", () => {
	it("converts hv to kW with one decimal", () => {
		expect(hvToKw(100)).toBe(73.5);
		expect(hvToKw(61)).toBe(44.9);
	});
});

describe("kwToHv", () => {
	it("converts kW to whole hv", () => {
		expect(kwToHv(45)).toBe(61);
		expect(kwToHv(73.5)).toBe(100);
	});
});

describe("round trip", () => {
	it("keeps every whole hv value from 1 to 680", () => {
		for (let hv = 1; hv <= 680; hv++) {
			expect(kwToHv(hvToKw(hv))).toBe(hv);
		}
	});
});

describe("formatPower", () => {
	it("shows a whole kW without decimals", () => {
		expect(formatPower(45)).toBe("45 kW (61 hv)");
	});

	it("shows a Finnish decimal comma for fractional kW", () => {
		expect(formatPower(73.5)).toBe("73,5 kW (100 hv)");
	});
});
