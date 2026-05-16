// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { ListingCard } from "./listing-card";

vi.mock("~/lib/i18n", () => ({
	formatEur: (cents: number) => `${(cents / 100).toFixed(0)} €`,
	useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock TanStack Router's Link as a plain <a> tag
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params, ...props }: Record<string, unknown>) => (
		<a href={String(to || "/")} {...props}>
			{children as React.ReactNode}
		</a>
	),
}));

afterEach(cleanup);

const baseListing: Listing & { price?: number } = {
	id: "uuid-1",
	short_id: "abc123XY",
	owner_id: "owner-1",
	category: "rental",
	title: "Honda CB500F vuokraus",
	make_id: "make-1",
	model_id: "model-1",
	year: 2022,
	engine_cc: 471,
	required_license: "A2",
	motorcycle_type: "naked",
	city: "Helsinki",
	region: "uusimaa",
	postal_code: null,
	description: "Hyvä pyörä",
	price: 5000,
	status: "active",
	view_count: 10,
	expires_at: null,
	expiry_notified_at: null,
	reviewed_at: null,
	created_at: new Date("2026-01-01"),
	updated_at: new Date("2026-01-01"),
	search_vector: "",
};

const baseImages: ListingImage[] = [
	{
		id: "img-1",
		listing_id: "uuid-1",
		url: "https://storage.example.com/main.webp",
		thumbnail_url: "https://storage.example.com/thumb.webp",
		order: 0,
	},
];

describe("ListingCard", () => {
	it("renders title and price", () => {
		render(
			<ListingCard listing={baseListing} images={baseImages} makeSlug="honda" modelName="CB500F" />,
		);

		expect(screen.getByTestId("listing-card-title")).toHaveTextContent("Honda CB500F vuokraus");
		expect(screen.getByTestId("listing-card-price")).toHaveTextContent("50 €");
	});

	it("renders image when available", () => {
		render(
			<ListingCard listing={baseListing} images={baseImages} makeSlug="honda" modelName="CB500F" />,
		);

		const img = screen.getByAltText("Honda CB500F vuokraus");
		expect(img).toHaveAttribute("src", "https://storage.example.com/main.webp");
	});

	it("renders no img tag when no images", () => {
		render(<ListingCard listing={baseListing} images={[]} makeSlug="honda" modelName="CB500F" />);

		expect(screen.queryByAltText("Honda CB500F vuokraus")).not.toBeInTheDocument();
	});

	it("shows license badge", () => {
		render(
			<ListingCard listing={baseListing} images={baseImages} makeSlug="honda" modelName="CB500F" />,
		);

		expect(screen.getByText("A2")).toBeInTheDocument();
	});

	it("shows motorcycle type and engine cc", () => {
		render(
			<ListingCard listing={baseListing} images={baseImages} makeSlug="honda" modelName="CB500F" />,
		);

		expect(screen.getByText(/Naked.*471 cc/)).toBeInTheDocument();
	});

	it("shows city and region", () => {
		render(
			<ListingCard listing={baseListing} images={baseImages} makeSlug="honda" modelName="CB500F" />,
		);

		expect(screen.getByText(/Helsinki.*Uusimaa/)).toBeInTheDocument();
	});

	it("shows 'new' badge for recent listings", () => {
		const recentListing = { ...baseListing, created_at: new Date() };

		render(
			<ListingCard
				listing={recentListing}
				images={baseImages}
				makeSlug="honda"
				modelName="CB500F"
			/>,
		);

		expect(screen.getByText("card.newBadge")).toBeInTheDocument();
	});

	it("shows 'own' badge when isOwn", () => {
		render(
			<ListingCard
				listing={baseListing}
				images={baseImages}
				makeSlug="honda"
				modelName="CB500F"
				isOwn
			/>,
		);

		expect(screen.getByText("card.ownBadge")).toBeInTheDocument();
	});

	it("shows image count when multiple images", () => {
		const multiImages: ListingImage[] = [
			baseImages[0],
			{ ...baseImages[0], id: "img-2", order: 1 },
			{ ...baseImages[0], id: "img-3", order: 2 },
		];

		render(
			<ListingCard
				listing={baseListing}
				images={multiImages}
				makeSlug="honda"
				modelName="CB500F"
			/>,
		);

		expect(screen.getByText("📷 3")).toBeInTheDocument();
	});
});
