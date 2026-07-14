// src/routes/ilmoitukset/uusi.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ListingForm } from "~/components/listings/listing-form";
import { categoryDetailPath } from "~/lib/category-routes";
import { SITE_NAME } from "~/lib/constants";
import { AppError } from "~/lib/errors";
import { useTranslation } from "~/lib/i18n";
import { createListing } from "~/lib/listings-commands";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { requireSessionOrRedirect, requireUserId } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { isValidImageUrl, listingFormSchema } from "~/lib/validators";

const createListingFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("create-listing", 5, 60))
	.inputValidator((data: ListingFormData) => listingFormSchema().parse(data))
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		if (
			data.images.some(
				(img) =>
					!isValidImageUrl(img.url) || (img.thumbnail_url && !isValidImageUrl(img.thumbnail_url)),
			)
		) {
			throw new AppError("listing.invalid_image", { field: "images" });
		}

		const result = await createListing(userId, data);

		log.event(EVENTS.listing.created, { listingId: result.id });

		return result;
	});

export const Route = createFileRoute("/ilmoitukset/uusi")({
	loader: async ({ location }) => ({ session: await requireSessionOrRedirect(location.pathname) }),
	head: () => ({
		meta: [{ title: `Uusi ilmoitus — ${SITE_NAME}` }],
	}),
	component: NewListingPage,
});

function NewListingPage() {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	async function handleSubmit(data: ListingFormData) {
		const result = await createListingFn({ data });
		const slug = computeListingSlug(result.makeSlug, result.modelName, result.city);
		navigate({
			href: categoryDetailPath(data.category, result.shortId, slug),
			replace: true,
		});
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-primary">{t("create.pageTitle")}</h1>
					<p className="mt-1 text-sm text-muted">{t("create.pageSubtitle")}</p>
				</div>
				<ListingForm onSubmit={handleSubmit} submitLabel={t("create.submitLabel")} />
			</div>
		</div>
	);
}
