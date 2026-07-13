import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Call-recording DB mock ---
// Same queue idea as bookings.server.test.ts, plus a call log so tests can
// assert which columns a write touches (the terms_accepted_at semantics live
// there). onConflict invokes its callback so the update branch is recorded.

const executeQueue: unknown[] = [];
const executeTakeFirstQueue: unknown[] = [];
const calls: Array<{ method: string; args: unknown[] }> = [];

function chainable(): unknown {
	return new Proxy(
		{},
		{
			get(_, prop: string) {
				if (prop === "execute") {
					return () => executeQueue.shift();
				}
				if (prop === "executeTakeFirst") {
					return () => executeTakeFirstQueue.shift();
				}
				return (...args: unknown[]) => {
					calls.push({ method: prop, args });
					if (prop === "onConflict" && typeof args[0] === "function") {
						(args[0] as (oc: unknown) => unknown)(chainable());
					}
					return chainable();
				};
			},
		},
	);
}

vi.mock("~/lib/db/index", () => ({
	db: {
		selectFrom: () => chainable(),
		insertInto: () => chainable(),
	},
}));

vi.mock("kysely", () => {
	const sqlResult = { as: () => sqlResult, $call: () => sqlResult };
	const sqlProxy = new Proxy(() => sqlResult, {
		apply: () => sqlResult,
		get: () => sqlProxy,
	});
	return { sql: sqlProxy };
});

vi.mock("~/lib/listings-owner", () => ({
	getOwnerActiveListings: vi.fn(),
}));

vi.mock("~/lib/reviews.server", () => ({
	getReviewsForUser: vi.fn(),
	computeReviewSummary: vi.fn(),
}));

import { getOwnerActiveListings } from "./listings-owner";
import {
	completeProfile,
	getProfileForEdit,
	getPublicProfile,
	updateSettings,
} from "./profile.server";
import { computeReviewSummary, getReviewsForUser } from "./reviews.server";

function recordedArg(method: string): Record<string, unknown> {
	const call = calls.find((c) => c.method === method);
	expect(call, `expected a ${method}() call`).toBeDefined();
	return (call as { args: unknown[] }).args[0] as Record<string, unknown>;
}

beforeEach(() => {
	executeQueue.length = 0;
	executeTakeFirstQueue.length = 0;
	calls.length = 0;
	vi.clearAllMocks();
});

describe("getProfileForEdit", () => {
	it("returns null when no profile row exists", async () => {
		executeTakeFirstQueue.push(undefined);
		expect(await getProfileForEdit("user-1")).toBeNull();
	});

	it("returns the edit view", async () => {
		const row = { display_name: "Matti", city: "Helsinki", phone: null, show_phone: false };
		executeTakeFirstQueue.push(row);
		expect(await getProfileForEdit("user-1")).toEqual(row);
	});
});

describe("getPublicProfile", () => {
	it("returns null (and skips listings/reviews) when profile is missing", async () => {
		executeTakeFirstQueue.push(undefined);
		expect(await getPublicProfile("user-1")).toBeNull();
		expect(getOwnerActiveListings).not.toHaveBeenCalled();
		expect(getReviewsForUser).not.toHaveBeenCalled();
	});

	it("composes profile, active listings, and reviews", async () => {
		const profile = {
			user_id: "user-1",
			display_name: "Matti",
			city: "Helsinki",
			created_at: new Date(),
		};
		executeTakeFirstQueue.push(profile);
		const listings = [{ id: "l1" }];
		const images = [{ listing_id: "l1" }];
		const reviews = [{ id: "r1", rating: 5 }];
		const summary = { averageRating: 5, reviewCount: 1 };
		vi.mocked(getOwnerActiveListings).mockResolvedValue(
			// biome-ignore lint/suspicious/noExplicitAny: test stub
			{ listings, images } as any,
		);
		// biome-ignore lint/suspicious/noExplicitAny: test stub
		vi.mocked(getReviewsForUser).mockResolvedValue(reviews as any);
		// biome-ignore lint/suspicious/noExplicitAny: test stub
		vi.mocked(computeReviewSummary).mockReturnValue(summary as any);

		const result = await getPublicProfile("user-1");

		expect(result).toEqual({ profile, listings, images, reviews, reviewSummary: summary });
		expect(getOwnerActiveListings).toHaveBeenCalledWith("user-1");
		expect(computeReviewSummary).toHaveBeenCalledWith(reviews);
	});
});

describe("completeProfile", () => {
	const input = { displayName: "Matti", city: "", phone: "" };

	it("stamps terms_accepted_at on insert and nulls empty strings", async () => {
		await completeProfile("user-1", input);
		const values = recordedArg("values");
		expect(values.terms_accepted_at).toBeInstanceOf(Date);
		expect(values.city).toBeNull();
		expect(values.phone).toBeNull();
		expect(values.language).toBe("fi");
	});

	it("stamps a null terms_accepted_at on existing rows (coalesce) and bumps updated_at", async () => {
		await completeProfile("user-1", input);
		const update = recordedArg("doUpdateSet");
		// mocked sql`coalesce(...)` marker — the column must be part of the update set
		expect(update.terms_accepted_at).toBeDefined();
		expect(update.updated_at).toBeInstanceOf(Date);
	});
});

describe("updateSettings", () => {
	const input = { displayName: "Matti", city: "Helsinki", phone: "+358401234567", showPhone: true };

	it("never touches terms_accepted_at", async () => {
		await updateSettings("user-1", input);
		expect(recordedArg("values")).not.toHaveProperty("terms_accepted_at");
		expect(recordedArg("doUpdateSet")).not.toHaveProperty("terms_accepted_at");
	});

	it("writes show_phone on both insert and update branches", async () => {
		await updateSettings("user-1", input);
		expect(recordedArg("values").show_phone).toBe(true);
		expect(recordedArg("doUpdateSet").show_phone).toBe(true);
		expect(recordedArg("doUpdateSet").updated_at).toBeInstanceOf(Date);
	});
});
