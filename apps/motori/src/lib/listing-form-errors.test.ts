import { describe, expect, it } from "vitest";
import { mapListingIssues } from "./listing-form-errors";

const valueKeys = [
	"title",
	"city",
	"region",
	"description",
	"make_id",
	"model_id",
	"year",
	"price_per_day",
	"sale_price",
	"sale_condition",
	"sale_km_driven",
	"gear_price",
	"part_price",
	"part_part_category",
];

describe("mapListingIssues", () => {
	it("maps a plain path to the same form key", () => {
		const { fieldErrors, unmapped } = mapListingIssues(
			[{ path: ["title"], message: "Otsikko on liian lyhyt" }],
			"sale",
			valueKeys,
		);
		expect(fieldErrors).toEqual({ title: "Otsikko on liian lyhyt" });
		expect(unmapped).toEqual([]);
	});

	it("maps a schema name to the category-prefixed form key", () => {
		const { fieldErrors } = mapListingIssues(
			[{ path: ["price"], message: "Hinta on pakollinen" }],
			"sale",
			valueKeys,
		);
		expect(fieldErrors).toEqual({ sale_price: "Hinta on pakollinen" });
	});

	it("maps multiple issues on multiple fields", () => {
		const { fieldErrors, unmapped } = mapListingIssues(
			[
				{ path: ["title"], message: "Otsikko on liian lyhyt" },
				{ path: ["price"], message: "Hinta on pakollinen" },
				{ path: ["condition"], message: "Valitse kunto" },
			],
			"sale",
			valueKeys,
		);
		expect(fieldErrors).toEqual({
			title: "Otsikko on liian lyhyt",
			sale_price: "Hinta on pakollinen",
			sale_condition: "Valitse kunto",
		});
		expect(unmapped).toEqual([]);
	});

	it("keeps the first message when one field has multiple issues", () => {
		const { fieldErrors } = mapListingIssues(
			[
				{ path: ["price"], message: "Hinta on pakollinen" },
				{ path: ["price"], message: "Virheellinen hinta" },
			],
			"sale",
			valueKeys,
		);
		expect(fieldErrors).toEqual({ sale_price: "Hinta on pakollinen" });
	});

	it("collects issues without a matching form key as unmapped", () => {
		const { fieldErrors, unmapped } = mapListingIssues(
			[
				{ path: ["images", 0, "url"], message: "Virheellinen kuva-URL" },
				{ path: ["title"], message: "Otsikko on liian lyhyt" },
			],
			"sale",
			valueKeys,
		);
		expect(fieldErrors).toEqual({ title: "Otsikko on liian lyhyt" });
		expect(unmapped).toEqual(["Virheellinen kuva-URL"]);
	});

	it("treats an issue with an empty path as unmapped", () => {
		const { fieldErrors, unmapped } = mapListingIssues(
			[{ path: [], message: "Virheellinen syöte" }],
			"gear",
			valueKeys,
		);
		expect(fieldErrors).toEqual({});
		expect(unmapped).toEqual(["Virheellinen syöte"]);
	});

	it("returns empty results for no issues", () => {
		const { fieldErrors, unmapped } = mapListingIssues([], "rental", valueKeys);
		expect(fieldErrors).toEqual({});
		expect(unmapped).toEqual([]);
	});

	it("prefers the plain key over the prefixed one when both exist", () => {
		const { fieldErrors } = mapListingIssues(
			[{ path: ["price_per_day"], message: "Päivähinta on pakollinen" }],
			"rental",
			valueKeys,
		);
		expect(fieldErrors).toEqual({ price_per_day: "Päivähinta on pakollinen" });
	});
});
