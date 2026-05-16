// src/routes/ilmoitukset/$listingId_.muokkaa.tsx
// Trailing underscore on $listingId_ opts out of $listingId_.$slug.tsx as parent layout.
import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
import { ListingForm } from "~/components/listings/listing-form";
import { Button } from "~/components/ui/button";
import { categoryDetailPath } from "~/lib/category-routes";
import { centsToEuros } from "~/lib/currency";
import type { ListingCategory } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { useTranslation } from "~/lib/i18n";
import { updateListing } from "~/lib/listings-commands";
import { getListingAvailability, getListingForEdit } from "~/lib/listings-detail";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { getSession } from "~/lib/session";
import { computeListingSlug } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";
import { availabilityUpdateSchema, isValidImageUrl, listingFormSchema } from "~/lib/validators";

const getListingForEditFn = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const result = await getListingForEdit(shortId, session.user.id);
		if (!result) {
			throw new AppError("listing.forbidden");
		}

		const availability = await getListingAvailability({ data: result.listing.id });
		return { ...result, availability };
	});

const updateListingFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("update-listing", 5, 60))
	.inputValidator((data: { id: string; form: ListingFormData }) => ({
		id: data.id,
		form: listingFormSchema().parse(data.form),
	}))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		if (
			data.form.images.some(
				(img) =>
					!isValidImageUrl(img.url) || (img.thumbnail_url && !isValidImageUrl(img.thumbnail_url)),
			)
		) {
			throw new AppError("listing.invalid_image", { field: "images" });
		}

		await updateListing(data.id, session.user.id, data.form);

		log.event(EVENTS.listing.updated, {
			listingId: data.id,
			fields: Object.keys(data.form).filter((k) => k !== "id"),
		});
	});

const updateAvailability = createServerFn({ method: "POST" })
	.middleware(protectedMutation("update-availability", 20, 60))
	.inputValidator((data: unknown) => availabilityUpdateSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}

		const { db } = await import("~/lib/db/index");
		const listing = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", data.listing_id)
			.executeTakeFirst();

		if (!listing || listing.owner_id !== session.user.id) {
			throw new AppError("listing.forbidden");
		}

		await db.transaction().execute(async (trx) => {
			// Ownership already verified above — listing_rental has no owner_id column
			const availResult = await trx
				.updateTable("listing_rental")
				.set({ availability_default: data.availability_default })
				.where("listing_id", "=", data.listing_id)
				.executeTakeFirst();

			if (availResult.numUpdatedRows === 0n) {
				throw new AppError("listing.forbidden");
			}

			await trx
				.deleteFrom("listing_availability_exception")
				.where("listing_id", "=", data.listing_id)
				.execute();

			if (data.exception_dates.length > 0) {
				await trx
					.insertInto("listing_availability_exception")
					.values(
						data.exception_dates.map((date) => ({
							listing_id: data.listing_id,
							date,
						})),
					)
					.execute();
			}
		});
	});

export const Route = createFileRoute("/ilmoitukset/$listingId_/muokkaa")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		const result = await getListingForEditFn({ data: params.listingId });
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

function AvailabilityEditor(props: {
	listingId: string;
	initialDefault: "open" | "closed";
	initialExceptions: string[];
	bookedDates: string[];
}) {
	const { t } = useTranslation("listings");
	const [defaultMode, setDefaultMode] = useState(props.initialDefault);
	const [exceptions, setExceptions] = useState(props.initialExceptions);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);

	function toggle(date: string) {
		setExceptions((prev) =>
			prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
		);
	}

	async function handleSave() {
		setSaving(true);
		try {
			await updateAvailability({
				data: {
					listing_id: props.listingId,
					availability_default: defaultMode,
					exception_dates: exceptions,
				},
			});
			setSavedAt(Date.now());
		} finally {
			setSaving(false);
		}
	}

	return (
		<section
			className="mt-8 rounded-l border border-border bg-card p-4"
			data-testid="availability-editor"
		>
			<h2 className="font-semibold">{t("availability.formTitle")}</h2>
			<div className="mt-3 flex gap-4 text-sm">
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="availability-default"
						checked={defaultMode === "open"}
						onChange={() => setDefaultMode("open")}
					/>
					{t("availability.defaultOpen")}
				</label>
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="availability-default"
						checked={defaultMode === "closed"}
						onChange={() => setDefaultMode("closed")}
					/>
					{t("availability.defaultClosed")}
				</label>
			</div>
			<p className="mt-2 text-xs text-muted">{t("availability.hint")}</p>
			<div className="mt-4">
				<AvailabilityCalendar
					availabilityDefault={defaultMode}
					exceptionDates={exceptions}
					bookedDates={props.bookedDates}
					mode="toggle-exceptions"
					onToggleException={toggle}
				/>
			</div>
			<div className="mt-4 flex items-center gap-3">
				<Button onClick={handleSave} disabled={saving}>
					{t("availability.saveButton")}
				</Button>
				{savedAt ? <span className="text-sm text-success">{t("availability.saved")}</span> : null}
			</div>
		</section>
	);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form component with conditional fields
function EditListingPage() {
	const { t } = useTranslation("listings");
	const { listing, rental, sale, gear, part, images, makeSlug, modelName, availability } =
		Route.useLoaderData();
	const navigate = useNavigate();

	const sharedInitial = {
		title: listing.title,
		city: listing.city,
		region: listing.region,
		postal_code: listing.postal_code ?? "",
		description: listing.description,
	};

	let initialValues: Partial<ListingFormData>;
	if (listing.category === "rental") {
		initialValues = {
			...sharedInitial,
			category: "rental",
			make_id: listing.make_id ?? undefined,
			model_id: listing.model_id ?? null,
			year: listing.year ?? undefined,
			engine_cc: listing.engine_cc,
			motorcycle_type: listing.motorcycle_type ?? undefined,
			required_license: listing.required_license,
			price_per_day: centsToEuros(rental?.price_per_day ?? 0),
			price_per_week: rental?.price_per_week ? centsToEuros(rental.price_per_week) : null,
			price_per_weekend: rental?.price_per_weekend ? centsToEuros(rental.price_per_weekend) : null,
			price_description: rental?.price_description ?? "",
			mileage_limit: rental?.mileage_limit,
		} as Partial<ListingFormData>;
	} else if (listing.category === "sale") {
		initialValues = {
			...sharedInitial,
			category: "sale",
			make_id: listing.make_id ?? undefined,
			model_id: listing.model_id ?? null,
			year: listing.year ?? undefined,
			engine_cc: listing.engine_cc,
			motorcycle_type: listing.motorcycle_type ?? undefined,
			required_license: listing.required_license,
			price: sale?.price ?? 0,
			condition: (sale?.condition ?? "good") as "new" | "excellent" | "good" | "fair" | "poor",
			km_driven: sale?.km_driven ?? null,
			negotiable: sale?.negotiable ?? false,
		} as Partial<ListingFormData>;
	} else if (listing.category === "gear") {
		initialValues = {
			...sharedInitial,
			category: "gear",
			gear_type: (gear?.gear_type ?? "other") as
				| "helmet"
				| "jacket"
				| "pants"
				| "boots"
				| "gloves"
				| "other",
			size: gear?.size ?? null,
			condition: (gear?.condition ?? "good") as "new" | "excellent" | "good" | "fair" | "poor",
			price: gear?.price ?? 0,
		} as Partial<ListingFormData>;
	} else {
		initialValues = {
			...sharedInitial,
			category: "part",
			part_category: part?.part_category ?? "",
			compatible_make_id: part?.compatible_make_id ?? null,
			condition: (part?.condition ?? "good") as "new" | "excellent" | "good" | "fair" | "poor",
			price: part?.price ?? 0,
		} as Partial<ListingFormData>;
	}

	async function handleSubmit(data: ListingFormData) {
		await updateListingFn({ data: { id: listing.id, form: data } });
		const slug = computeListingSlug(makeSlug ?? null, modelName ?? null, listing.city);
		navigate({
			href: categoryDetailPath(listing.category as ListingCategory, listing.short_id, slug),
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
					lockedCategory={listing.category as ListingCategory}
					initialCategory={listing.category as ListingCategory}
					initialValues={initialValues}
					initialImages={images.map((img) => ({ url: img.url, thumbnail_url: img.thumbnail_url }))}
					onSubmit={handleSubmit}
					submitLabel={t("edit.submitLabel")}
				/>
				{listing.category === "rental" && (
					<AvailabilityEditor
						listingId={listing.id}
						initialDefault={availability.availability_default}
						initialExceptions={availability.exception_dates}
						bookedDates={availability.booked_dates}
					/>
				)}
			</div>
		</div>
	);
}
