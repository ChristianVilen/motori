// src/routes/ilmoitukset/uusi.tsx
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ListingForm } from "~/components/listings/listing-form";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import type { ListingFormData } from "~/lib/validators";
import { listingFormSchema } from "~/lib/validators";

const createListing = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 60, "create-listing"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: ListingFormData) => listingFormSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään ensin");
		}

		// Validate image URLs against configured storage domain (replaced by Cloudflare image refactor)
		const storageBase = process.env.STORAGE_PUBLIC_URL;
		if (storageBase && data.image_urls.some((url) => !url.startsWith(storageBase))) {
			throw new Error("Virheellinen kuva-URL");
		}

		const id = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

		await db
			.insertInto("listing")
			.values({
				id,
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

		if (data.image_urls.length > 0) {
			await db
				.insertInto("listing_image")
				.values(
					data.image_urls.map((url, i) => ({
						id: crypto.randomUUID(),
						listing_id: id,
						url,
						order: i,
					})),
				)
				.execute();
		}

		return { id };
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
		meta: [{ title: "Uusi ilmoitus — Vuokramoto" }],
	}),
	component: NewListingPage,
});

function NewListingPage() {
	const { t } = useTranslation("listings");
	const navigate = useNavigate();

	async function handleSubmit(data: ListingFormData) {
		const { id } = await createListing({ data });
		navigate({ to: "/ilmoitukset/$listingId", params: { listingId: id } });
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
