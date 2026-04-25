import { describe, expect, it } from "vitest";
import { toSlug } from "./makes";

describe("toSlug", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(toSlug("Moto Guzzi")).toBe("moto-guzzi");
	});
	it("preserves existing hyphens", () => {
		expect(toSlug("Harley-Davidson")).toBe("harley-davidson");
	});
	it("trims whitespace", () => {
		expect(toSlug("  Honda  ")).toBe("honda");
	});
	it("collapses multiple spaces to a single hyphen", () => {
		expect(toSlug("Royal  Enfield")).toBe("royal-enfield");
	});
	it("strips non-alphanumeric characters except hyphens", () => {
		expect(toSlug("Can/Am")).toBe("canam");
	});
});
