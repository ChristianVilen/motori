import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { SaleDetailSidebar } from "~/components/listings/sale-detail-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { useTranslation } from "~/lib/i18n";
import { getListingForDisplay, recordView } from "~/lib/listings-queries";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const result = await getListingForDisplay(shortId);
		if (!result || result.listing.category !== "sale") return null;

		const request = getRequest();
		const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		recordView(shortId, session?.user.id, ip);

		const [ownerReviewSummary, ownerProfile] = await Promise.all([
			getReviewSummaryForUser(result.listing.owner_id),
			(async () => {
				const { db } = await import("~/lib/db/index");
				return db
					.selectFrom("profile")
					.select(["phone", "show_phone"])
					.where("user_id", "=", result.listing.owner_id)
					.executeTakeFirst();
			})(),
		]);

		return { ...result, ownerReviewSummary, ownerProfile: ownerProfile ?? null };
	});

export const Route = createFileRoute("/pyorat/myynti/$listingId_/$slug")({
	loader: async ({ params }) => {
		const [result, session] = await Promise.all([
			getListing({ data: params.listingId }),
			getSession(),
		]);
		if (!result) throw notFound();
		return { ...result, session };
	},
	head: ({ loaderData }) => {
		const l = loaderData?.listing;
		if (!l) return {};
		const price = loaderData?.sale?.price ?? 0;
		const slug = computeListingSlug(loaderData?.makeSlug ?? null, loaderData?.modelName ?? null, l.city);
		const url = `${SITE_URL}/pyorat/myynti/${l.short_id}/${slug}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään ${loaderData?.makeName ?? ""} ${loaderData?.modelName ?? ""} (${l.year ?? ""}) — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
		return {
			meta: [{ title }, { name: "description", content: desc }, { property: "og:url", content: url }],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: SaleDetailPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-muted">{t("detail.notFound")}</p>
			</div>
		);
	},
});

function SaleDetailPage() {
	const { listing, sale, images, session, makeName, makeSlug, modelName, ownerReviewSummary, ownerProfile } =
		Route.useLoaderData();
	const { t } = useTranslation("listings");
	const isOwner = session?.user.id === listing.owner_id;

	return (
		<ListingDetailShell
			data={{ listing, rental: null, sale, gear: null, part: null, images, makeName, makeSlug, modelName, ownerReviewSummary }}
			session={session}
			backTo="/pyorat/myynti"
			backLabel={t("detail.back")}
			sidebar={
				<SaleDetailSidebar
					listing={listing}
					sale={sale!}
					isOwner={isOwner}
					ownerPhoneVisible={ownerProfile?.show_phone ?? false}
					ownerPhone={ownerProfile?.phone ?? null}
					ownerUserId={listing.owner_id}
				/>
			}
		/>
	);
}
