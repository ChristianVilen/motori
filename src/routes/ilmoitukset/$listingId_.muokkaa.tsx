// src/routes/ilmoitukset/$listingId_.muokkaa.tsx
// Trailing underscore on $listingId_ opts out of $listingId_.$slug.tsx as parent layout.
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "~/components/listings/listing-form";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { isValidImageUrl, listingFormSchema } from "~/lib/validators";

const getListingForEdit = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const row = await db
			.selectFrom("listing")
			.leftJoin("motorcycle_make", "motorcycle_make.id", "listing.make_id")
			.leftJoin("motorcycle_model", "motorcycle_model.id", "listing.model_id")
			.selectAll("listing")
			.select(["motorcycle_make.slug as makeSlug", "motorcycle_model.name as modelName"])
			.where("listing.short_id", "=", shortId)
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const { makeSlug, modelName, ...listing } = row;

		if (listing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", listing.id)
			.orderBy("order", "asc")
			.execute();

		return { listing, images, makeSlug: makeSlug ?? null, modelName: modelName ?? null };
	});

const updateListing = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "update-listing"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: { id: string; form: ListingFormData }) => ({
		id: data.id,
		form: listingFormSchema.parse(data.form),
	}))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		// Validate image URLs — must be from our storage (Cloudflare or local dev)
		if (data.form.images.some((img) => !isValidImageUrl(img.url))) {
			throw new Error("Virheellinen kuva-URL");
		}

		const existing = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", data.id)
			.executeTakeFirst();

		if (!existing) {
			throw new Error("Ilmoitusta ei löydy");
		}
		if (existing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		const { form } = data;

		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({
					title: form.title,
					make_id: form.make_id,
					model_id: form.model_id ?? null,
					year: form.year,
					engine_cc: form.engine_cc ?? null,
					required_license: form.required_license ?? null,
					motorcycle_type: form.motorcycle_type,
					price_per_day: Math.round(form.price_per_day * 100),
					price_per_week: form.price_per_week ? Math.round(form.price_per_week * 100) : null,
					price_description: form.price_description ?? null,
					city: form.city,
					region: form.region,
					postal_code: form.postal_code ?? null,
					description: form.description,
					mileage_limit: form.mileage_limit ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", data.id)
				.execute();

			await trx.deleteFrom("listing_image").where("listing_id", "=", data.id).execute();

			if (form.images.length > 0) {
				await trx
					.insertInto("listing_image")
					.values(
						form.images.map((img, i) => ({
							id: crypto.randomUUID(),
							listing_id: data.id,
							url: img.url,
							thumbnail_url: img.thumbnail_url ?? null,
							order: i,
						})),
					)
					.execute();
			}
		});

		log.event(EVENTS.listing.updated, {
			listingId: data.id,
			fields: Object.keys(data.form).filter((k) => k !== "id"),
		});
	});

export const Route = createFileRoute("/ilmoitukset/$listingId_/muokkaa")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		const result = await getListingForEdit({ data: params.listingId });
		if (!result) {
			throw notFound();
		}
		return result;
	},
	component: EditListingPage,
	notFoundComponent: () => {
		const { t } = useTranslation("listings");
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-4">
				<p className="text-muted">{t("edit.notFound")}</p>
				<Link to="/omat" className="text-sm text-accent underline">
					{t("edit.notFoundBack")}
				</Link>
			</div>
		);
	},
});

function EditListingPage() {
	const { t } = useTranslation("listings");
	const { listing, images, makeSlug, modelName } = Route.useLoaderData();
	const navigate = useNavigate();

	const initialValues = {
		title: listing.title,
		make_id: listing.make_id,
		model_id: listing.model_id ?? null,
		year: listing.year,
		engine_cc: listing.engine_cc,
		motorcycle_type: listing.motorcycle_type,
		required_license: listing.required_license,
		price_per_day: listing.price_per_day / 100,
		price_per_week: listing.price_per_week ? listing.price_per_week / 100 : null,
		price_description: listing.price_description ?? "",
		city: listing.city,
		region: listing.region,
		postal_code: listing.postal_code ?? "",
		description: listing.description,
		mileage_limit: listing.mileage_limit,
	};

	async function handleSubmit(data: ListingFormData) {
		await updateListing({ data: { id: listing.id, form: data } });
		const slug = computeListingSlug(makeSlug, modelName, listing.city);
		navigate({
			to: "/ilmoitukset/$listingId/$slug",
			params: { listingId: listing.short_id, slug },
			replace: true,
		});
	}

	const slug = computeListingSlug(makeSlug, modelName, listing.city);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<Link
						to="/ilmoitukset/$listingId/$slug"
						params={{ listingId: listing.short_id, slug }}
						className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						{t("edit.back")}
					</Link>
					<h1 className="text-2xl font-bold text-primary">{t("edit.pageTitle")}</h1>
					<p className="mt-1 text-sm text-muted">{listing.title}</p>
				</div>
				<ListingForm
					initialValues={initialValues}
					initialImages={images.map((img) => ({ url: img.url, thumbnail_url: img.thumbnail_url }))}
					onSubmit={handleSubmit}
					submitLabel={t("edit.submitLabel")}
				/>
			</div>
		</div>
	);
}