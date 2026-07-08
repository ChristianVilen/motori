import { describe, expect, test } from "vitest";
import { wrapEmail } from "./email-wrapper";

describe("wrapEmail", () => {
	test("replaces {{content}} with provided HTML", () => {
		const result = wrapEmail("<p>Hello</p>");
		expect(result).toContain("<p>Hello</p>");
		expect(result).not.toContain("{{content}}");
	});

	test("includes Motori brand header", () => {
		const result = wrapEmail("<p>Test</p>");
		expect(result).toContain("Motori");
	});

	test("includes motori.fi footer link", () => {
		const result = wrapEmail("<p>Test</p>");
		expect(result).toContain("motori.fi");
	});
});
