import { describe, expect, it } from "vitest";
import { formatDate, formatEur, formatNumber } from "./format";

describe("formatEur", () => {
	// Finnish locale uses NBSP (U+00A0) as the thousands separator and before the currency
	// symbol, with comma as decimal. Pinned on Node 24 / ICU 78; the grouping char is ICU-dependent.
	it("drops decimals for whole-euro amounts", () => {
		expect(formatEur(4500)).toBe("45\u00a0€");
	});

	it("groups thousands with NBSP", () => {
		expect(formatEur(1290000)).toBe("12\u00a0900\u00a0€");
	});

	it("keeps two decimals for non-whole amounts", () => {
		expect(formatEur(4550)).toBe("45,50\u00a0€");
	});

	it("handles zero", () => {
		expect(formatEur(0)).toBe("0\u00a0€");
	});

	it("handles values under one euro", () => {
		expect(formatEur(50)).toBe("0,50\u00a0€");
	});
});

describe("formatNumber", () => {
	it("groups thousands with NBSP", () => {
		expect(formatNumber(12300)).toBe("12\u00a0300");
	});
});

describe("formatDate", () => {
	// Local-time construction: formatDate renders local components, so a UTC
	// instant would land on a different day in far-east/west timezones.
	it("formats a date in Finnish short style", () => {
		const d = new Date(2026, 3, 18, 12);
		expect(formatDate(d)).toMatch(/18\.4\.2026|18\.04\.2026/);
	});

	it("accepts Intl options", () => {
		const d = new Date(2026, 3, 18, 12);
		const out = formatDate(d, { month: "long", year: "numeric" });
		expect(out.toLowerCase()).toContain("huhtikuu");
	});
});
