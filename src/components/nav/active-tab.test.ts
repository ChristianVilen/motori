import { describe, expect, it } from "vitest";
import { getActiveTab } from "./active-tab";

describe("getActiveTab", () => {
	it("returns 'browse' only for exact '/'", () => {
		expect(getActiveTab("/")).toBe("browse");
		expect(getActiveTab("/pyorat/myynti")).toBe(null);
	});

	it("returns 'bookings' for /omat and sub-paths", () => {
		expect(getActiveTab("/omat")).toBe("bookings");
		expect(getActiveTab("/omat/varaukset")).toBe("bookings");
	});

	it("returns 'account' for /asetukset and sub-paths", () => {
		expect(getActiveTab("/asetukset")).toBe("account");
		expect(getActiveTab("/asetukset/profile")).toBe("account");
	});

	it("returns null for unrelated routes", () => {
		expect(getActiveTab("/ilmoitukset/uusi")).toBe(null);
		expect(getActiveTab("/varusteet")).toBe(null);
	});
});
