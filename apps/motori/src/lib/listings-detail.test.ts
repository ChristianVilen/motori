import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeQueue, executeTakeFirstQueue, resetDbMock } from "~/test/kysely-mock";

vi.mock("~/lib/db/index", async () => (await import("~/test/kysely-mock")).dbModuleMock());
vi.mock("kysely", async () => (await import("~/test/kysely-mock")).kyselyModuleMock());

import { getListingForDisplay, getListingForEdit } from "./listings-detail";

beforeEach(resetDbMock);

const listingRow = { id: "l1", category: "sale", owner_id: "u1", makeSlug: null, modelName: null };

function queueEdit(salePower: string | null) {
	executeTakeFirstQueue.push(listingRow); // listing row
	executeQueue.push([]); // images
	executeTakeFirstQueue.push(Promise.resolve({ listing_id: "l1", power_kw: salePower })); // sale row
}

describe("sale power_kw read", () => {
	it("returns the numeric string from pg as a number in getListingForEdit", async () => {
		queueEdit("73.5");

		const result = await getListingForEdit("abc", "u1");

		expect(result?.sale?.power_kw).toBe(73.5);
	});

	it("returns a number in getListingForDisplay", async () => {
		executeTakeFirstQueue.push({ ...listingRow, makeName: null }); // listing row
		executeQueue.push([]); // images
		executeTakeFirstQueue.push(Promise.resolve({ listing_id: "l1", power_kw: "73.5" })); // sale row
		executeTakeFirstQueue.push(undefined); // owner (none)

		const result = await getListingForDisplay("abc");

		expect(result?.sale?.power_kw).toBe(73.5);
	});

	it("keeps null as null", async () => {
		queueEdit(null);

		const result = await getListingForEdit("abc", "u1");

		expect(result?.sale?.power_kw).toBeNull();
	});
});
