import { describe, expect, it } from "vitest";
import { formatDate, formatEur } from "./format";

describe("formatEur", () => {
	it("formats cents as Finnish euros with non-breaking space and comma", () => {
		// Finnish locale uses NBSP (U+00A0) before the currency symbol and comma as decimal.
		expect(formatEur(4500)).toBe("45,00\u00a0€");
	});

	it("handles zero", () => {
		expect(formatEur(0)).toBe("0,00\u00a0€");
	});

	it("handles values under one euro", () => {
		expect(formatEur(50)).toBe("0,50\u00a0€");
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
