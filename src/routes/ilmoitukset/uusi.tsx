// src/routes/ilmoitukset/uusi.tsx
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ListingForm } from "~/components/listings/listing-form";
import { SITE_NAME } from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { computeListingSlug, generateShortId } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { isValidImageUrl, listingFormSchema } from "~/lib/validators";

const createListing = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "create-listing"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: ListingFormData) => listingFormSchema().parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ensin");
		}

		// Validate image URLs — must be from our storage (Cloudflare or local dev)
		if (data.images.some((img) => !isValidImageUrl(img.url))) {
			throw new Error("Virheellinen kuva-URL");
		}

		const id = crypto.randomUUID();
		const shortId = generateShortId();
		const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

		await db
			.insertInto("listing")
			.values({
				id,
				short_id: shortId,
				owner_id: session.user.id,
				title: data.title,
				make_id: data.make_id,
				model_id: data.model_id ?? null,
				year: data.year,
				engine_cc: data.engine_cc ?? null,
				required_license: data.required_license ?? null,
				motorcycle_type: data.motorcycle_type,
				price_per_day: Math.round(data.price_per_day * 100),
				price_per_week: data.price_per_week ? Math.round(data.price_per_week * 100) : null,
				price_per_weekend: data.price_per_weekend ? Math.round(data.price_per_weekend * 100) : null,
				price_description: data.price_description ?? null,
				city: data.city,
				region: data.region,
				postal_code: data.postal_code ?? null,
				description: data.description,
				mileage_limit: data.mileage_limit ?? null,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		log.event(EVENTS.listing.created, { listingId: id });

		if (data.images.length > 0) {
			await db
				.insertInto("listing_image")
				.values(
					data.images.map((img, i) => ({
						id: crypto.randomUUID(),
						listing_id: id,
						url: img.url,
						thumbnail_url: img.thumbnail_url ?? null,
						order: i,
					})),
				)
				.execute();
		}

		const make = await db
			.selectFrom("motorcycle_make")
			.select(["slug"])
			.where("id", "=", data.make_id)
			.executeTakeFirst();

		const model = data.model_id
			? await db
					.selectFrom("motorcycle_model")
					.select(["name"])
					.where("id", "=", data.model_id)
					.executeTakeFirst()
			: null;

		return {
			shortId,
			makeSlug: make?.slug ?? null,
			modelName: model?.name ?? null,
			city: data.city,
		};
	});

export const Route = createFileRoute("/ilmoitukset/uusi")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		return { session };
	},
	head: () => ({
		meta: [{ title: `Uusi ilmoitus — ${SITE_NAME}` }],
	}),
	component: NewListingPage,
});

function NewListingPage() {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	async function handleSubmit(data: ListingFormData) {
		const result = await createListing({ data });
		const slug = computeListingSlug(result.makeSlug, result.modelName, result.city);
		navigate({
			to: "/ilmoitukset/$listingId/$slug",
			params: { listingId: result.shortId, slug },
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
