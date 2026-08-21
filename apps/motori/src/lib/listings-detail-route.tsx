// Factory for the three non-rental category detail routes (sale, gear, part).
// Rental is bespoke (booking form + mobile bar) and lives in its own file.
//
// The factory holds the duplicated server fn + loader + notFoundComponent +
// useLoaderData destructure + the sticky mobile price/contact bar. Each route
// file owns its createFileRoute path (the codegen reads the literal string)
// and supplies the category-specific sidebar, head meta, and price extractor.

import {
	Link,
	type LinkProps,
	notFound,
	useLoaderData,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { FC, ReactNode } from "react";
import { z } from "zod";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { formatEur, type TFunc, useTranslation } from "~/lib/i18n";
import { getListingForDisplay, type ListingForDisplay, recordView } from "~/lib/listings-detail";
import { startConversation } from "~/lib/messages";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";

type ReviewSummary = { averageRating: number | null; reviewCount: number };

type LoaderResult = ListingForDisplay & {
	ownerReviewSummary: ReviewSummary;
	session: { user: { id: string; email: string } } | null;
};

type HeadInput = LoaderResult;

interface DefineCategoryDetailRouteArgs<C extends "sale" | "gear" | "part"> {
	category: C;
	backTo: LinkProps["to"];
	Sidebar: FC<{
		data: LoaderResult;
		isOwner: boolean;
	}>;
	priceCents: (data: LoaderResult) => number;
	head: (loaderData: HeadInput | undefined) => Record<string, unknown>;
}

function MobileBottomBar({
	priceCents,
	isOwner,
	isActive,
	isLoggedIn,
	redirectPath,
	onMessageClick,
	t,
}: {
	priceCents: number;
	isOwner: boolean;
	isActive: boolean;
	isLoggedIn: boolean;
	redirectPath: string;
	onMessageClick: () => void;
	t: TFunc;
}) {
	return (
		<div className="fixed inset-x-0 bottom-16 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-md md:bottom-0 lg:hidden">
			<div className="flex items-center justify-between gap-4">
				<span data-testid="mobile-price" className="text-lg font-bold text-accent">
					{formatEur(priceCents)}
				</span>
				{!isOwner && isActive && !isLoggedIn ? (
					<Link
						to="/kirjaudu"
						search={{ redirect: redirectPath }}
						data-testid="mobile-login-to-contact"
						className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
					>
						{t("detail.loginToContact")}
					</Link>
				) : null}
				{!isOwner && isActive && isLoggedIn ? (
					<button
						type="button"
						data-testid="mobile-message-seller"
						onClick={onMessageClick}
						className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
					>
						{t("detail.messageSeller", "Lähetä viesti")}
					</button>
				) : null}
			</div>
		</div>
	);
}

const categoryDetailInput = z.object({
	shortId: z.string().min(1).max(20),
	category: z.enum(["sale", "rental", "gear", "part"]),
});

const getCategoryListing = createServerFn({ method: "GET" })
	.inputValidator((input: unknown) => categoryDetailInput.parse(input))
	.handler(async ({ data }) => {
		const session = await getSession();
		const result = await getListingForDisplay(data.shortId);
		if (!result || result.listing.category !== data.category) {
			return null;
		}

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordView(data.shortId, session?.user.id, ip);

		const ownerReviewSummary = await getReviewSummaryForUser(result.listing.owner_id);
		return { ...result, ownerReviewSummary };
	});

export function defineCategoryDetailRoute<C extends "sale" | "gear" | "part">(
	args: DefineCategoryDetailRouteArgs<C>,
) {
	const { category, backTo, Sidebar, priceCents, head } = args;

	async function loader({ params }: { params: { listingId: string } }): Promise<LoaderResult> {
		const [result, session] = await Promise.all([
			getCategoryListing({ data: { shortId: params.listingId, category } }),
			getSession(),
		]);
		if (!result) {
			throw notFound();
		}
		return { ...result, session };
	}

	function Component(): ReactNode {
		const data = useLoaderData({ strict: false }) as LoaderResult;
		const { t } = useTranslation("listings");
		const navigate = useNavigate();
		const pathname = useRouterState({ select: (s) => s.location.pathname });
		const isOwner = data.session?.user.id === data.listing.owner_id;

		async function onMobileMessageSeller() {
			const { conversationId } = await startConversation({
				data: { listingId: data.listing.id },
			});
			navigate({ to: "/viestit/$conversationId", params: { conversationId } });
		}

		return (
			<ListingDetailShell
				data={data}
				session={data.session}
				backTo={backTo}
				backLabel={t("detail.back")}
				sidebar={<Sidebar data={data} isOwner={isOwner} />}
				mobileBar={
					<MobileBottomBar
						priceCents={priceCents(data)}
						isOwner={isOwner}
						isActive={data.listing.status === "active"}
						isLoggedIn={!!data.session}
						redirectPath={pathname}
						onMessageClick={onMobileMessageSeller}
						t={t}
					/>
				}
			/>
		);
	}

	function NotFoundComponent(): ReactNode {
		const { t } = useTranslation("listings");
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-muted">{t("detail.notFound")}</p>
			</div>
		);
	}

	return {
		loader,
		head: (ctx: { loaderData?: LoaderResult }) => head(ctx.loaderData),
		component: Component,
		notFoundComponent: NotFoundComponent,
	};
}

export type { LoaderResult as CategoryDetailLoaderResult };
