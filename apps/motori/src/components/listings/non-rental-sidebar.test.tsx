// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "~/lib/db/schema";
import { NonRentalSidebar } from "./non-rental-sidebar";

vi.mock("~/lib/i18n", () => ({
	formatEur: (cents: number) => `${(cents / 100).toFixed(0)} €`,
	useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock("~/lib/messages", () => ({
	startConversation: vi.fn(async () => ({ conversationId: "conv-1" })),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, to, params, search, ...props }: Record<string, unknown>) => (
		<a href={String(to || "/")} {...props}>
			{children as React.ReactNode}
		</a>
	),
	useNavigate: () => vi.fn(),
	useRouterState: () => "/pyorat/myynti/abc123XY/honda-cb500f",
}));

afterEach(cleanup);

const baseListing: Listing = {
	id: "uuid-1",
	short_id: "abc123XY",
	owner_id: "owner-1",
	category: "sale",
	title: "Honda CB500F",
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
	status: "active",
	view_count: 10,
	expires_at: null,
	expiry_notified_at: null,
	reviewed_at: null,
	created_at: new Date("2026-01-01"),
	updated_at: new Date("2026-01-01"),
	search_vector: "",
};

function renderSidebar(overrides: Partial<Parameters<typeof NonRentalSidebar>[0]> = {}) {
	return render(
		<NonRentalSidebar
			price={10000}
			priceTestId="price-sale"
			statRows={[]}
			listing={baseListing}
			isOwner={false}
			ownerPhoneVisible={false}
			ownerPhone={null}
			{...overrides}
		/>,
	);
}

describe("NonRentalSidebar seller CTA", () => {
	it("shows the login link when logged out, listing active, not owner", () => {
		renderSidebar();

		expect(screen.getByTestId("login-to-contact")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /lähetä viesti/i })).not.toBeInTheDocument();
	});

	it("shows the message button when logged in, listing active, not owner", () => {
		renderSidebar({ currentUserId: "user-1" });

		expect(screen.getByRole("button", { name: /lähetä viesti/i })).toBeInTheDocument();
		expect(screen.queryByTestId("login-to-contact")).not.toBeInTheDocument();
	});

	it("shows neither CTA for the owner", () => {
		renderSidebar({ isOwner: true, currentUserId: "owner-1", listing: baseListing });

		expect(screen.queryByTestId("login-to-contact")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /lähetä viesti/i })).not.toBeInTheDocument();
	});

	it("shows no login link when logged out and the listing is not active", () => {
		renderSidebar({ listing: { ...baseListing, status: "sold" } });

		expect(screen.queryByTestId("login-to-contact")).not.toBeInTheDocument();
	});
});
