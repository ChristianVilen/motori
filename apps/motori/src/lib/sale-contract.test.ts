import { describe, expect, it } from "vitest";
import {
	createContract,
	draftKey,
	normalizeListingQuery,
	parseDraft,
	remove,
	restore,
} from "./sale-contract";

describe("sale contract", () => {
	it("starts blank and fills only public vehicle and price fields", () => {
		const blank = createContract(null);
		expect(blank.vehicle.make).toBe("");

		const draft = createContract({
			make: "Honda",
			model: "CB500F",
			year: 2022,
			km_driven: 12345,
			color: "Punainen",
			power_kw: 35,
			price: 450050,
		});

		expect(draft.vehicle).toEqual({
			registration: "",
			vin: "",
			make: "Honda",
			model: "CB500F",
			year: "2022",
			mileage: "12345",
			color: "Punainen",
			power: "35 kW (48 hv)",
		});
		expect(draft.sale.price).toBe("4500,50");
		expect(draft.seller).toEqual(blank.seller);
		expect(draft.buyer).toEqual(blank.buyer);
	});

	it("removes and restores optional blocks and individual statements without changing values", () => {
		const draft = createContract(null);
		draft.defects = "Scratch";

		const removed = remove(remove(draft, "defects"), "debtFree");

		expect(removed.removed).toEqual(["defects", "debtFree"]);
		expect(remove(removed, "defects").removed).toEqual(["defects", "debtFree"]);
		expect(restore(restore(removed, "defects"), "debtFree")).toEqual(draft);
	});

	it("rejects corrupt stored drafts and attempts to remove core blocks", () => {
		const draft = createContract(null);

		expect(parseDraft(JSON.stringify(draft))).toEqual(draft);
		expect(parseDraft("not json")).toBeNull();
		expect(parseDraft(JSON.stringify({ ...draft, removed: ["seller"] }))).toBeNull();
		expect(parseDraft(JSON.stringify({ ...draft, vehicle: {} }))).toBeNull();
	});

	it("separates saved drafts by validated listing context", () => {
		expect(normalizeListingQuery("e2esale1")).toBe("e2esale1");
		for (const value of [undefined, "", "../bad", ["e2esale1"], 12]) {
			expect(normalizeListingQuery(value)).toBeUndefined();
		}

		expect(draftKey("e2esale1")).not.toBe(draftKey("e2esale2"));
		expect(draftKey(undefined)).not.toBe(draftKey("e2esale1"));
		expect(draftKey(undefined)).not.toBe(draftKey("blank"));
	});
});
