import { eurosToCents } from "~/lib/currency";
import { AppError } from "~/lib/errors";
import { generateShortId } from "~/lib/slug";
import type { ListingFormData } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

export type CreateListingResult = {
	id: string;
	shortId: string;
	makeSlug: string | null;
	modelName: string | null;
	city: string;
};

export async function createListing(
	ownerId: string,
	data: ListingFormData,
): Promise<CreateListingResult> {
	const db = await getDb();
	const id = crypto.randomUUID();
	const shortId = generateShortId();
	const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

	await db
		.insertInto("listing")
		.values({
			id,
			short_id: shortId,
			owner_id: ownerId,
			category: "rental",
			title: data.title,
			make_id: data.make_id,
			model_id: data.model_id ?? null,
			year: data.year,
			engine_cc: data.engine_cc ?? null,
			required_license: data.required_license ?? null,
			motorcycle_type: data.motorcycle_type,
			city: data.city,
			region: data.region,
			postal_code: data.postal_code ?? null,
			description: data.description,
			expires_at: expiresAt,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	await db
		.insertInto("listing_rental")
		.values({
			listing_id: id,
			price_per_day: eurosToCents(data.price_per_day),
			price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
			price_per_weekend: data.price_per_weekend ? eurosToCents(data.price_per_weekend) : null,
			price_description: data.price_description ?? null,
			mileage_limit: data.mileage_limit ?? null,
		})
		.execute();

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

	const [make, model] = await Promise.all([
		db
			.selectFrom("motorcycle_make")
			.select(["slug"])
			.where("id", "=", data.make_id)
			.executeTakeFirst(),
		data.model_id
			? db
					.selectFrom("motorcycle_model")
					.select(["name"])
					.where("id", "=", data.model_id)
					.executeTakeFirst()
			: Promise.resolve(null),
	]);

	return {
		id,
		shortId,
		makeSlug: make?.slug ?? null,
		modelName: model?.name ?? null,
		city: data.city,
	};
}

export async function updateListing(
	id: string,
	ownerId: string,
	data: ListingFormData,
): Promise<void> {
	const db = await getDb();
	const existing = await db
		.selectFrom("listing")
		.select(["owner_id"])
		.where("id", "=", id)
		.executeTakeFirst();

	if (!existing) {
		throw new AppError("listing.not_found");
	}
	if (existing.owner_id !== ownerId) {
		throw new AppError("listing.forbidden");
	}

	await db.transaction().execute(async (trx) => {
		const updateResult = await trx
			.updateTable("listing")
			.set({
				title: data.title,
				make_id: data.make_id,
				model_id: data.model_id ?? null,
				year: data.year,
				engine_cc: data.engine_cc ?? null,
				required_license: data.required_license ?? null,
				motorcycle_type: data.motorcycle_type,
				city: data.city,
				region: data.region,
				postal_code: data.postal_code ?? null,
				description: data.description,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.where("owner_id", "=", ownerId)
			.executeTakeFirst();

		if (updateResult.numUpdatedRows === 0n) {
			throw new AppError("listing.forbidden");
		}

		await trx
			.updateTable("listing_rental")
			.set({
				price_per_day: eurosToCents(data.price_per_day),
				price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
				price_per_weekend: data.price_per_weekend ? eurosToCents(data.price_per_weekend) : null,
				price_description: data.price_description ?? null,
				mileage_limit: data.mileage_limit ?? null,
			})
			.where("listing_id", "=", id)
			.execute();

		await trx.deleteFrom("listing_image").where("listing_id", "=", id).execute();

		if (data.images.length > 0) {
			await trx
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
	});
}

export async function setListingStatus(
	id: string,
	ownerId: string,
	status: "active" | "paused" | "removed",
): Promise<void> {
	const db = await getDb();
	const listing = await db
		.selectFrom("listing")
		.select(["owner_id"])
		.where("id", "=", id)
		.executeTakeFirst();

	if (!listing || listing.owner_id !== ownerId) {
		throw new AppError("listing.forbidden");
	}

	const result = await db
		.updateTable("listing")
		.set({ status, updated_at: new Date() })
		.where("id", "=", id)
		.where("owner_id", "=", ownerId)
		.executeTakeFirst();

	if (result.numUpdatedRows === 0n) {
		throw new AppError("listing.forbidden");
	}
}
