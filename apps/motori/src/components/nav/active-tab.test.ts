import { describe, expect, it } from "vitest";
import { getActiveTab, getBrowseCategory } from "./active-tab";

describe("getActiveTab", () => {
	it("returns 'browse' for '/'", () => {
		expect(getActiveTab("/")).toBe("browse");
	});

	it("returns 'browse' for /pyorat/myynti and sub-paths", () => {
		expect(getActiveTab("/pyorat/myynti")).toBe("browse");
		expect(getActiveTab("/pyorat/myynti/abc123/bmw-r-ninet")).toBe("browse");
	});

	it("returns 'browse' for /pyorat/vuokraus and sub-paths", () => {
		expect(getActiveTab("/pyorat/vuokraus")).toBe("browse");
		expect(getActiveTab("/pyorat/vuokraus/abc123")).toBe("browse");
	});

	it("returns 'browse' for /varusteet and sub-paths", () => {
		expect(getActiveTab("/varusteet")).toBe("browse");
		expect(getActiveTab("/varusteet/kypara")).toBe("browse");
	});

	it("returns 'browse' for /varaosat and sub-paths", () => {
		expect(getActiveTab("/varaosat")).toBe("browse");
		expect(getActiveTab("/varaosat/xyz/some-part")).toBe("browse");
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
	});
});

describe("getBrowseCategory", () => {
	it("returns 'sale' for /pyorat/myynti and sub-paths", () => {
		expect(getBrowseCategory("/pyorat/myynti")).toBe("sale");
		expect(getBrowseCategory("/pyorat/myynti/abc123/bmw-r-ninet")).toBe("sale");
	});

	it("returns 'rental' for /pyorat/vuokraus and sub-paths", () => {
		expect(getBrowseCategory("/pyorat/vuokraus")).toBe("rental");
		expect(getBrowseCategory("/pyorat/vuokraus/abc123/some-bike")).toBe("rental");
	});

	it("returns 'gear' for /varusteet and sub-paths", () => {
		expect(getBrowseCategory("/varusteet")).toBe("gear");
		expect(getBrowseCategory("/varusteet/abc123/kypara")).toBe("gear");
	});

	it("returns 'part' for /varaosat and sub-paths", () => {
		expect(getBrowseCategory("/varaosat")).toBe("part");
		expect(getBrowseCategory("/varaosat/xyz/some-part")).toBe("part");
	});

	it("defaults to 'sale' for neutral pages", () => {
		expect(getBrowseCategory("/")).toBe("sale");
		expect(getBrowseCategory("/viestit")).toBe("sale");
		expect(getBrowseCategory("/omat/suosikit")).toBe("sale");
		expect(getBrowseCategory("/kirjaudu")).toBe("sale");
	});
});
