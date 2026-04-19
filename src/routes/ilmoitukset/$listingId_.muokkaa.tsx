// src/routes/ilmoitukset/$listingId_.muokkaa.tsx
// Trailing underscore on $listingId_ opts out of $listingId.tsx as parent layout.
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "~/components/listings/listing-form";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { getSession } from "~/lib/session";
import type { ListingFormData } from "~/lib/validators";
import { listingFormSchema } from "~/lib/validators";

const getListingForEdit = createServerFn({ method: "GET" })
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const listing = await db
			.selectFrom("listing")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!listing) {
			return null;
		}
		if (listing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		const images = await db
			.selectFrom("listing_image")
			.selectAll()
			.where("listing_id", "=", id)
			.orderBy("order", "asc")
			.execute();

		return { listing, images };
	})

const updateListing = createServerFn({ method: "POST" })
	.inputValidator((data: { id: string; form: ListingFormData }) => ({
		id: data.id,
		form: listingFormSchema.parse(data.form),
	}))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
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
					brand: form.brand,
					model: form.model,
					year: form.year,
					engine_cc: form.engine_cc ?? null,
					required_license: form.required_license ?? null,
					motorcycle_type: form.motorcycle_type,
					price_per_day: Math.round(form.price_per_day * 100),
					price_per_week: form.price_per_week ? Math.round(form.price_per_week * 100) : null,
					price_description: form.price_description ?? null,
					deposit_amount: form.deposit_amount ? Math.round(form.deposit_amount * 100) : null,
					city: form.city,
					region: form.region,
					postal_code: form.postal_code ?? null,
					available_from: form.available_from ?? null,
					available_to: form.available_to ?? null,
					season_only: form.season_only,
					description: form.description,
					includes_helmet: form.includes_helmet,
					includes_insurance: form.includes_insurance,
					insurance_info: form.insurance_info ?? null,
					mileage_limit: form.mileage_limit ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", data.id)
				.execute()

			await trx.deleteFrom("listing_image").where("listing_id", "=", data.id).execute();

			if (form.image_urls.length > 0) {
				await trx
					.insertInto("listing_image")
					.values(
						form.image_urls.map((url, i) => ({
							id: crypto.randomUUID(),
							listing_id: data.id,
							url,
							order: i,
						})),
					)
					.execute()
			}
		})

		log.event(EVENTS.listing.updated, {
			listingId: data.id,
			fields: Object.keys(data.form).filter((k) => k !== "id"),
		})
	})

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
		)
	},
});

function EditListingPage() {
	const { t } = useTranslation("listings");
	const { listing, images } = Route.useLoaderData();
	const navigate = useNavigate();

	const initialValues = {
		title: listing.title,
		brand: listing.brand,
		model: listing.model,
		year: listing.year,
		engine_cc: listing.engine_cc,
		motorcycle_type: listing.motorcycle_type,
		required_license: listing.required_license,
		price_per_day: listing.price_per_day / 100,
		price_per_week: listing.price_per_week ? listing.price_per_week / 100 : null,
		deposit_amount: listing.deposit_amount ? listing.deposit_amount / 100 : null,
		price_description: listing.price_description ?? "",
		city: listing.city,
		region: listing.region,
		postal_code: listing.postal_code ?? "",
		available_from: listing.available_from ?? "",
		available_to: listing.available_to ?? "",
		season_only: listing.season_only,
		description: listing.description,
		includes_helmet: listing.includes_helmet,
		includes_insurance: listing.includes_insurance,
		insurance_info: listing.insurance_info ?? "",
		mileage_limit: listing.mileage_limit,
	}

	async function handleSubmit(data: ListingFormData) {
		await updateListing({ data: { id: listing.id, form: data } });
		navigate({ to: "/ilmoitukset/$listingId", params: { listingId: listing.id } });
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-2xl px-4 py-8">
				<div className="mb-8">
					<Link
						to="/ilmoitukset/$listingId"
						params={{ listingId: listing.id }}
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
					initialImageUrls={images.map((img) => img.url)}
					onSubmit={handleSubmit}
					submitLabel={t("edit.submitLabel")}
				/>
			</div>
		</div>
	)
}
