// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Listing, ListingImage } from "~/lib/db/schema";
import { createI18nSync } from "~/lib/i18n/server";
import { ListingCard } from "./listing-card";

vi.mock("~/lib/favorites-context", () => ({
	useFavorites: () => ({ isFavorite: () => false, toggle: () => {} }),
}));

// Mock TanStack Router's Link as a plain <a> tag
vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params, state, ...props }: Record<string, unknown>) => (
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

const i18n = createI18nSync("fi");

function renderCard(props: Partial<ComponentProps<typeof ListingCard>> = {}) {
	return render(
		<I18nextProvider i18n={i18n}>
			<ListingCard
				listing={baseListing}
				images={baseImages}
				makeSlug="honda"
				modelName="CB500F"
				{...props}
			/>
		</I18nextProvider>,
	);
}

describe("ListingCard", () => {
	it("shows the rental price, title, rental pill and facts", () => {
		renderCard();
		expect(screen.getByTestId("listing-card-title")).toHaveTextContent(baseListing.title);
		expect(screen.getByTestId("listing-card-price")).toHaveTextContent("50 € / vrk");
		expect(screen.getByText("Vuokra")).toBeVisible();
		expect(screen.getByTestId("listing-card-facts")).toHaveTextContent("2022 · 471 cc · Helsinki");
	});
	it("offers thumbnail and full-size sources", () => {
		renderCard();
		const image = screen.getByAltText(baseListing.title);
		expect(image).toHaveAttribute("src", baseImages[0].thumbnail_url);
		expect(image).toHaveAttribute(
			"srcset",
			`${baseImages[0].thumbnail_url} 400w, ${baseImages[0].url} 1600w`,
		);
	});
	it("uses the original when there is no thumbnail", () => {
		renderCard({ images: [{ ...baseImages[0], thumbnail_url: null }] });
		expect(screen.getByAltText(baseListing.title)).toHaveAttribute("src", baseImages[0].url);
	});
	it("keeps the card usable when the photo or facts are missing", () => {
		renderCard({ images: [], listing: { ...baseListing, category: "gear" } });
		expect(screen.queryByRole("img")).not.toBeInTheDocument();
		expect(screen.getByTestId("listing-card-facts")).toHaveTextContent(/^Helsinki$/);
	});
	it("keeps the favorite control outside the listing link", () => {
		renderCard();
		const heart = screen.getByRole("button", {
			name: `Tallenna suosikkeihin: ${baseListing.title}`,
		});
		expect(heart).toHaveAttribute("aria-pressed", "false");
		expect(screen.getByRole("link")).not.toContainElement(heart);
	});
	it("retains owner and status badges", () => {
		renderCard({ listing: { ...baseListing, status: "sold" }, isOwn: true });
		expect(screen.getByText("Oma")).toBeVisible();
		expect(screen.getByTestId("listing-card-status")).toHaveTextContent("Myyty");
	});
	it("shows sale mileage, gear size, and translated part categories", () => {
		for (const [fields, line] of [
			[{ category: "sale", km_driven: 12300 }, "2022 · 12 300 km · Helsinki"],
			[{ category: "gear", size: "M", condition: "good" }, "Koko M · Hyvä · Helsinki"],
			[
				{ category: "part", part_category: "brakes", condition: "good" },
				"Jarrut · Hyvä · Helsinki",
			],
		] as const) {
			const view = renderCard({ listing: { ...baseListing, ...fields } });
			expect(screen.getByTestId("listing-card-facts")).toHaveTextContent(line);
			view.unmount();
		}
	});
});
