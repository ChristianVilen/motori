import { describe, expect, it, vi } from "vitest";

// Mock TanStack imports — we only test the head wrapper's argument forwarding,
// not the loader (which is integration-tested via e2e).
vi.mock("@tanstack/react-router", () => ({
	notFound: () => new Error("notFound"),
	useLoaderData: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({ handler: () => () => null }),
	}),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => null }));
vi.mock("~/components/listings/listing-detail-shell", () => ({ ListingDetailShell: () => null }));
vi.mock("~/lib/listings-detail.server", () => ({
	getListingForDisplay: vi.fn(),
	recordView: vi.fn(),
}));
vi.mock("~/lib/reviews.server", () => ({ getReviewSummaryForUser: vi.fn() }));
vi.mock("~/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("~/lib/i18n", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

import { defineCategoryDetailRoute } from "./listings-detail-route";

describe("defineCategoryDetailRoute", () => {
	const mkConfig = () =>
		defineCategoryDetailRoute({
			category: "sale",
			backTo: "/pyorat/myynti",
			Sidebar: () => null,
			head: (loaderData) =>
				loaderData ? { meta: [{ title: loaderData.listing.title }] } : { meta: [] },
		});

	it("head wrapper forwards loaderData to user callback", () => {
		const config = mkConfig();
		const fakeListing = { title: "Test bike" };
		const result = config.head({ loaderData: { listing: fakeListing } as never });
		expect(result).toEqual({ meta: [{ title: "Test bike" }] });
	});

	it("head wrapper passes undefined when loaderData is missing", () => {
		const config = mkConfig();
		const result = config.head({});
		expect(result).toEqual({ meta: [] });
	});

	it("returns the standard four-property route config shape", () => {
		const config = mkConfig();
		expect(config).toHaveProperty("loader");
		expect(config).toHaveProperty("head");
		expect(config).toHaveProperty("component");
		expect(config).toHaveProperty("notFoundComponent");
	});
});
