import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ListingDetailShell } from "~/components/listings/listing-detail-shell";
import { PartDetailSidebar } from "~/components/listings/part-detail-sidebar";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { centsToEuros } from "~/lib/currency";
import { useTranslation } from "~/lib/i18n";
import { getListingForDisplay, recordView } from "~/lib/listings-queries";
import { getReviewSummaryForUser } from "~/lib/reviews.server";
import { getSession } from "~/lib/session";
import { slugify } from "~/lib/slug";

const getListing = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		const result = await getListingForDisplay(shortId);
		if (!result || result.listing.category !== "part") return null;

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

export const Route = createFileRoute("/varaosat/$listingId_/$slug")({
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
		const price = loaderData?.part?.price ?? 0;
		const url = `${SITE_URL}/varaosat/${l.short_id}/${slugify(l.title)}`;
		const title = `${l.title} — ${SITE_NAME}`;
		const desc = `Myydään varaosa: ${l.title} — ${l.city}. Hinta ${centsToEuros(price).toFixed(0)} €.`;
		return {
			meta: [{ title }, { name: "description", content: desc }, { property: "og:url", content: url }],
			links: [{ rel: "canonical", href: url }],
		};
	},
	component: PartDetailPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-muted">{t("detail.notFound")}</p>
			</div>
		);
	},
});

function PartDetailPage() {
	const { listing, part, images, session, makeName, makeSlug, modelName, ownerReviewSummary, ownerProfile } =
		Route.useLoaderData();
	const { t } = useTranslation("listings");
	const isOwner = session?.user.id === listing.owner_id;

	return (
		<ListingDetailShell
			data={{ listing, rental: null, sale: null, gear: null, part, images, makeName, makeSlug, modelName, ownerReviewSummary }}
			session={session}
			backTo="/varaosat"
			backLabel={t("detail.back")}
			sidebar={
				<PartDetailSidebar
					listing={listing}
					part={part!}
					isOwner={isOwner}
					ownerPhoneVisible={ownerProfile?.show_phone ?? false}
					ownerPhone={ownerProfile?.phone ?? null}
					ownerUserId={listing.owner_id}
				/>
			}
		/>
	);
}
