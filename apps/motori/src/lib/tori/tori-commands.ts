import { createServerFn } from "@tanstack/react-start";
import { eurosToCents } from "~/lib/currency";
import type { ListingCategory } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { requireUserId } from "~/lib/session";
import { generateShortId } from "~/lib/slug";
import { TORI_EXPIRY_DAYS } from "~/lib/tori/constants";
import { toriItemFormSchema } from "~/lib/tori/validators";
import { isValidImageUrl } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

type ToriListingStatus = "active" | "paused" | "sold" | "removed";

function validateImages(images: Array<{ url: string }>) {
	for (const img of images) {
		if (!isValidImageUrl(img.url)) {
			throw new AppError("tori.invalid_image");
		}
	}
}

/** Map tori form category to listing category */
function toListingCategory(cat: string): ListingCategory {
	if (cat === "gear" || cat === "apparel") {
		return "gear";
	}
	return "part";
}

export const createToriItem = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-create", 10, 3600))
	.inputValidator(toriItemFormSchema)
	.handler(async ({ data }) => {
		const ownerId = await requireUserId();
		const db = await getDb();

		validateImages(data.images);

		const id = crypto.randomUUID();
		const shortId = generateShortId();
		const expiresAt = new Date(Date.now() + TORI_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
		const category = toListingCategory(data.category);

		await db.transaction().execute(async (trx) => {
			await trx
				.insertInto("listing")
				.values({
					id,
					short_id: shortId,
					owner_id: ownerId,
					category,
					title: data.title,
					description: data.description,
					city: data.city,
					region: data.region,
					postal_code: data.postal_code ?? null,
					expires_at: expiresAt,
					created_at: new Date(),
					updated_at: new Date(),
				})
				.execute();

			if (category === "gear") {
				await trx
					.insertInto("listing_gear")
					.values({
						listing_id: id,
						gear_type: "other",
						condition: data.condition,
						price: eurosToCents(data.price),
					})
					.execute();
			} else {
				await trx
					.insertInto("listing_part")
					.values({
						listing_id: id,
						part_category: data.category,
						condition: data.condition,
						price: eurosToCents(data.price),
					})
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

		log.event(EVENTS.tori.created, { itemId: id, category: data.category });
		return { id, shortId };
	});

export const updateToriItem = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-update", 20, 3600))
	.inputValidator((input: { id: string; data: unknown }) => {
		const data = toriItemFormSchema.parse(input.data);
		return { id: input.id, data };
	})
	.handler(async ({ data: { id, data } }) => {
		const ownerId = await requireUserId();
		const db = await getDb();

		validateImages(data.images);

		const existing = await db
			.selectFrom("listing")
			.select(["owner_id", "category"])
			.where("id", "=", id)
			.executeTakeFirst();

		if (!existing) {
			throw new AppError("tori.not_found");
		}
		if (existing.owner_id !== ownerId) {
			throw new AppError("tori.forbidden");
		}

		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({
					title: data.title,
					description: data.description,
					city: data.city,
					region: data.region,
					postal_code: data.postal_code ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();

			if (existing.category === "gear") {
				await trx
					.updateTable("listing_gear")
					.set({
						condition: data.condition,
						price: eurosToCents(data.price),
					})
					.where("listing_id", "=", id)
					.execute();
			} else {
				await trx
					.updateTable("listing_part")
					.set({
						part_category: data.category,
						condition: data.condition,
						price: eurosToCents(data.price),
					})
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

		log.event(EVENTS.tori.updated, { itemId: id });
	});

export const setToriItemStatus = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-status", 30, 3600))
	.inputValidator((input: { id: string; status: string }) => {
		const allowed: ToriListingStatus[] = ["active", "paused", "sold", "removed"];
		if (!allowed.includes(input.status as ToriListingStatus)) {
			throw new Error("Invalid status");
		}
		return { id: input.id, status: input.status as ToriListingStatus };
	})
	.handler(async ({ data: { id, status } }) => {
		const ownerId = await requireUserId();
		const db = await getDb();

		const item = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", id)
			.where("category", "in", ["gear", "part"])
			.executeTakeFirst();

		if (!item || item.owner_id !== ownerId) {
			throw new AppError("tori.forbidden");
		}

		const updates: Record<string, unknown> = { status, updated_at: new Date() };
		if (status === "active") {
			updates.expires_at = new Date(Date.now() + TORI_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
		}

		await db.updateTable("listing").set(updates).where("id", "=", id).execute();

		log.event(EVENTS.tori.status_changed, { itemId: id, status });
	});
