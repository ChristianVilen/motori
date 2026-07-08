import { describe, expect, it } from "vitest";
import { toPrefixTsQuery, toTsQuery } from "./search";

describe("toTsQuery", () => {
	it("returns null for empty input", () => {
		expect(toTsQuery("")).toBeNull();
		expect(toTsQuery("   ")).toBeNull();
	});

	it("returns trimmed input", () => {
		expect(toTsQuery("  honda  ")).toBe("honda");
	});
});

describe("toPrefixTsQuery", () => {
	it("returns null for empty input", () => {
		expect(toPrefixTsQuery("")).toBeNull();
		expect(toPrefixTsQuery("   ")).toBeNull();
	});

	it("single word gets prefix operator", () => {
		expect(toPrefixTsQuery("honda")).toBe("'honda':*");
	});

	it("multiple words: last gets prefix, others are plain", () => {
		expect(toPrefixTsQuery("shoei kypä")).toBe("'shoei' & 'kypä':*");
	});

	it("three words", () => {
		expect(toPrefixTsQuery("red honda cb")).toBe("'red' & 'honda' & 'cb':*");
	});

	it("escapes single quotes", () => {
		expect(toPrefixTsQuery("o'neal")).toBe("'o''neal':*");
	});

	it("handles extra whitespace", () => {
		expect(toPrefixTsQuery("  shoei   neo  ")).toBe("'shoei' & 'neo':*");
	});
});
