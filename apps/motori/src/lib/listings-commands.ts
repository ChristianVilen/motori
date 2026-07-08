import { eurosToCents } from "~/lib/currency";
import type { GearType } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { generateShortId } from "~/lib/slug";
import type {
	GearFormData,
	ListingFormData,
	PartFormData,
	RentalFormData,
	SaleFormData,
} from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

// Listing columns editable by both create and update. Bike fields are nulled for
// gear/part. Create layers id/owner/timestamps on top; update adds updated_at.
// `bike` is an aliased condition so TS narrows data.make_id etc. to the bike variants.
function editableListingColumns(data: ListingFormData) {
	const bike = data.category === "sale" || data.category === "rental";
	return {
		title: data.title,
		make_id: bike ? data.make_id : null,
		model_id: bike ? (data.model_id ?? null) : null,
		year: bike ? data.year : null,
		engine_cc: bike ? (data.engine_cc ?? null) : null,
		required_license: bike ? (data.required_license ?? null) : null,
		motorcycle_type: bike ? data.motorcycle_type : null,
		city: data.city,
		region: data.region,
		postal_code: data.postal_code ?? null,
		description: data.description,
	};
}

// Child-table column values shared by create (insert) and update (set).
// Callers add listing_id for inserts; updates match on it in the where clause.
const rentalValues = (data: RentalFormData) => ({
	price_per_day: eurosToCents(data.price_per_day),
	price_per_week: data.price_per_week ? eurosToCents(data.price_per_week) : null,
	price_per_weekend: data.price_per_weekend ? eurosToCents(data.price_per_weekend) : null,
	price_description: data.price_description ?? null,
	mileage_limit: data.mileage_limit ?? null,
});
const saleValues = (data: SaleFormData) => ({
	price: eurosToCents(data.price),
	condition: data.condition,
	km_driven: data.km_driven ?? null,
	negotiable: data.negotiable,
});
const gearValues = (data: GearFormData) => ({
	gear_type: data.gear_type as GearType,
	size: data.size ?? null,
	condition: data.condition,
	price: eurosToCents(data.price),
});
const partValues = (data: PartFormData) => ({
	part_category: data.part_category,
	compatible_make_id: data.compatible_make_id ?? null,
	compatible_model_id: null,
	condition: data.condition,
	price: eurosToCents(data.price),
});

export type CreateListingResult = {
	id: string;
	shortId: string;
	category: string;
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
	const bike = data.category === "sale" || data.category === "rental";

	await db.transaction().execute(async (trx) => {
		await trx
			.insertInto("listing")
			.values({
				id,
				short_id: shortId,
				owner_id: ownerId,
				category: data.category,
				...editableListingColumns(data),
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		if (data.category === "rental") {
			await trx
				.insertInto("listing_rental")
				.values({ listing_id: id, ...rentalValues(data) })
				.execute();
		} else if (data.category === "sale") {
			await trx
				.insertInto("listing_sale")
				.values({ listing_id: id, ...saleValues(data) })
				.execute();
		} else if (data.category === "gear") {
			await trx
				.insertInto("listing_gear")
				.values({ listing_id: id, ...gearValues(data) })
				.execute();
		} else {
			await trx
				.insertInto("listing_part")
				.values({ listing_id: id, ...partValues(data) })
				.execute();
		}

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

	const [make, model] = await Promise.all([
		bike
			? db
					.selectFrom("motorcycle_make")
					.select(["slug"])
					.where("id", "=", data.make_id)
					.executeTakeFirst()
			: Promise.resolve(null),
		bike && data.model_id
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
		category: data.category,
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
		.select(["owner_id", "category"])
		.where("id", "=", id)
		.executeTakeFirst();

	if (!existing) {
		throw new AppError("listing.not_found");
	}
	if (existing.owner_id !== ownerId) {
		throw new AppError("listing.forbidden");
	}
	if (existing.category !== data.category) {
		throw new AppError("listing.forbidden");
	}

	await db.transaction().execute(async (trx) => {
		const result = await trx
			.updateTable("listing")
			.set({ ...editableListingColumns(data), updated_at: new Date() })
			.where("id", "=", id)
			.where("owner_id", "=", ownerId)
			.executeTakeFirst();

		if (result.numUpdatedRows === 0n) {
			throw new AppError("listing.forbidden");
		}

		if (data.category === "rental") {
			await trx
				.updateTable("listing_rental")
				.set(rentalValues(data))
				.where("listing_id", "=", id)
				.execute();
		} else if (data.category === "sale") {
			await trx
				.updateTable("listing_sale")
				.set(saleValues(data))
				.where("listing_id", "=", id)
				.execute();
		} else if (data.category === "gear") {
			await trx
				.updateTable("listing_gear")
				.set(gearValues(data))
				.where("listing_id", "=", id)
				.execute();
		} else {
			await trx
				.updateTable("listing_part")
				.set(partValues(data))
				.where("listing_id", "=", id)
				.execute();
		}

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
