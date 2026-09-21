import { afterEach, describe, expect, it } from "vitest";
import { isValidImageUrl } from "./image-url";

describe("isValidImageUrl", () => {
	afterEach(() => {
		delete process.env.STORAGE_PUBLIC_URL;
	});

	it("accepts local upload paths", () => {
		expect(isValidImageUrl("/api/uploads/abc.webp")).toBe(true);
	});

	it("rejects arbitrary URLs when STORAGE_PUBLIC_URL is not set", () => {
		expect(isValidImageUrl("https://evil.com/image.webp")).toBe(false);
	});

	it("accepts URLs matching STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi";
		expect(isValidImageUrl("https://storage.motori.fi/images/abc.webp")).toBe(true);
	});

	it("rejects URLs not matching STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi";
		expect(isValidImageUrl("https://evil.com/image.webp")).toBe(false);
	});

	it("rejects a look-alike origin that merely starts with STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = "https://images.motori.fi";
		expect(isValidImageUrl("https://images.motori.fi.evil.com/x.webp")).toBe(false);
	});

	it("accepts URLs when STORAGE_PUBLIC_URL has a trailing slash", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi/";
		expect(isValidImageUrl("https://storage.motori.fi/images/abc.webp")).toBe(true);
	});

	it("rejects the bare public URL with no key", () => {
		process.env.STORAGE_PUBLIC_URL = "https://storage.motori.fi";
		expect(isValidImageUrl("https://storage.motori.fi")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isValidImageUrl("")).toBe(false);
	});
});
