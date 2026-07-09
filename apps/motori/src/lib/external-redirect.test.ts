import { describe, expect, it } from "vitest";
import { resolveExternalRedirect } from "./external-redirect";

describe("resolveExternalRedirect", () => {
	it("returns null when redirect is undefined", () => {
		expect(resolveExternalRedirect(undefined, "motori.fi")).toBeNull();
	});

	it("allows talli's origin (exact) in prod", () => {
		expect(resolveExternalRedirect("https://talli.motori.fi", "motori.fi")).toBe(
			"https://talli.motori.fi",
		);
	});

	it("allows a path under talli's origin in prod", () => {
		expect(resolveExternalRedirect("https://talli.motori.fi/pyorat/uusi", "motori.fi")).toBe(
			"https://talli.motori.fi/pyorat/uusi",
		);
	});

	it("allows talli's origin on localhost in dev", () => {
		expect(resolveExternalRedirect("http://localhost:3001/", "localhost")).toBe(
			"http://localhost:3001/",
		);
	});

	it("rejects an unrelated external origin", () => {
		expect(resolveExternalRedirect("https://evil.example/", "motori.fi")).toBeNull();
	});

	it("rejects a suffix-smuggling host (talli.motori.fi.evil.com)", () => {
		expect(resolveExternalRedirect("https://talli.motori.fi.evil.com/", "motori.fi")).toBeNull();
	});

	it("rejects a userinfo bypass (talli.motori.fi@evil.com)", () => {
		expect(resolveExternalRedirect("https://talli.motori.fi@evil.com/", "motori.fi")).toBeNull();
	});

	it("does not allow the dev origin when running in prod", () => {
		expect(resolveExternalRedirect("http://localhost:3001/", "motori.fi")).toBeNull();
	});
});
