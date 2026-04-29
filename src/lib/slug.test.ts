import { describe, expect, it } from "vitest";
import { computeListingSlug, generateShortId, slugify } from "./slug";

describe("slugify", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("transliterates Finnish characters", () => {
		expect(slugify("Hämeenlinna")).toBe("hameenlinna");
		expect(slugify("Jyväskylä")).toBe("jyvaskyla");
		expect(slugify("Öölöö")).toBe("ooloo");
		expect(slugify("Åbo")).toBe("abo");
	});

	it("strips non-alphanumeric characters", () => {
		expect(slugify("CB500F!")).toBe("cb500f");
	});

	it("collapses multiple separators into one hyphen", () => {
		expect(slugify("foo   bar")).toBe("foo-bar");
		expect(slugify("foo---bar")).toBe("foo-bar");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-foo-")).toBe("foo");
	});
});

describe("computeListingSlug", () => {
	it("combines make slug, slugified model name, and slugified city", () => {
		expect(computeListingSlug("kawasaki", "Z650", "Helsinki")).toBe("kawasaki-z650-helsinki");
	});

	it("omits model segment when model is null", () => {
		expect(computeListingSlug("honda", null, "Tampere")).toBe("honda-tampere");
	});

	it("slugifies city and model name", () => {
		expect(computeListingSlug("yamaha", "MT-07", "Hämeenlinna")).toBe("yamaha-mt-07-hameenlinna");
	});

	it("handles null make slug gracefully", () => {
		expect(computeListingSlug(null, null, "Helsinki")).toBe("helsinki");
	});
});

describe("generateShortId", () => {
	it("returns exactly 8 characters", () => {
		expect(generateShortId()).toHaveLength(8);
	});

	it("contains only base62 characters", () => {
		for (let i = 0; i < 20; i++) {
			expect(generateShortId()).toMatch(/^[0-9A-Za-z]{8}$/);
		}
	});

	it("produces different values each call", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateShortId()));
		expect(ids.size).toBe(100);
	});
});
