import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify (make names)", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(slugify("Moto Guzzi")).toBe("moto-guzzi");
	});
	it("preserves existing hyphens", () => {
		expect(slugify("Harley-Davidson")).toBe("harley-davidson");
	});
	it("trims whitespace", () => {
		expect(slugify("  Honda  ")).toBe("honda");
	});
	it("collapses multiple non-alphanumeric chars to a single hyphen", () => {
		expect(slugify("Royal  Enfield")).toBe("royal-enfield");
	});
	it("handles Finnish characters (ä, ö)", () => {
		expect(slugify("Öhlins")).toBe("ohlins");
		expect(slugify("Pähkinä")).toBe("pahkina");
	});
});
