// Factory for the three non-rental category detail routes (sale, gear, part).
// Rental is bespoke (booking form + mobile bar) and lives in its own file.
//
// The factory holds the duplicated server fn + loader + notFoundComponent +
// useLoaderData destructure. Each route file owns its createFileRoute path
// (the codegen reads the literal string) and supplies the category-specific
// sidebar plus head meta.

import { type LinkProps, notFound, useLoaderData } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { FC, ReactNode } from "react";
import { z } from "zod";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { useTranslation } from "~/lib/i18n";
import { getListingForDisplay, type ListingForDisplay, recordView } from "~/lib/listings-detail.server";
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
	head: (loaderData: HeadInput | undefined) => Record<string, unknown>;
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
	const { category, backTo, Sidebar, head } = args;

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
		const isOwner = data.session?.user.id === data.listing.owner_id;

		return (
			<ListingDetailShell
				data={data}
				session={data.session}
				backTo={backTo}
				backLabel={t("detail.back")}
				sidebar={<Sidebar data={data} isOwner={isOwner} />}
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
