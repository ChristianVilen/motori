import { describe, expect, it } from "vitest";
import { getActiveTab } from "./active-tab";

describe("getActiveTab", () => {
	it("returns 'browse' only for exact '/'", () => {
		expect(getActiveTab("/")).toBe("browse");
		expect(getActiveTab("/pyorat/myynti")).toBe(null);
	});

	it("returns 'account' for /omat and sub-paths", () => {
		expect(getActiveTab("/omat")).toBe("account");
		expect(getActiveTab("/omat/varaukset")).toBe("account");
	});

	it("returns 'account' for /profiili/asetukset and sub-paths", () => {
		expect(getActiveTab("/profiili/asetukset")).toBe("account");
		expect(getActiveTab("/profiili/asetukset/profile")).toBe("account");
	});

	it("returns null for unrelated routes", () => {
		expect(getActiveTab("/ilmoitukset/uusi")).toBe(null);
		expect(getActiveTab("/varusteet")).toBe(null);
	});
});
