import { describe, expect, it } from "vitest";
import { computeApexRedirect } from "./apex-redirect";

describe("computeApexRedirect", () => {
	it("returns null when canonical host is not configured", () => {
		expect(computeApexRedirect(new Request("https://www.motori.fi/x"), undefined)).toBeNull();
	});

	it("returns null when the request host already matches canonical", () => {
		expect(
			computeApexRedirect(new Request("https://motori.fi/x"), "https://motori.fi"),
		).toBeNull();
	});

	it("301-redirects www.motori.fi to motori.fi preserving path and query", () => {
		const res = computeApexRedirect(
			new Request("https://www.motori.fi/listings?page=2"),
			"https://motori.fi",
		);
		expect(res).not.toBeNull();
		expect(res?.status).toBe(301);
		expect(res?.headers.get("location")).toBe("https://motori.fi/listings?page=2");
	});

	it("ignores port and scheme differences in BETTER_AUTH_URL", () => {
		const res = computeApexRedirect(
			new Request("https://www.motori.fi/"),
			"https://motori.fi/",
		);
		expect(res?.headers.get("location")).toBe("https://motori.fi/");
	});

	it("does not redirect localhost in dev", () => {
		expect(
			computeApexRedirect(new Request("http://localhost:3000/x"), "http://localhost:3000"),
		).toBeNull();
	});
});
