import { createServerFn } from "@tanstack/react-start";
import { eurosToCents } from "~/lib/currency";
import type { ToriItemStatus } from "~/lib/db/schema";
import { AppError } from "~/lib/errors";
import { protectedMutation } from "~/lib/middleware";
import { getSession } from "~/lib/session";
import { generateShortId } from "~/lib/slug";
import { TORI_EXPIRY_DAYS } from "~/lib/tori/constants";
import { toriItemFormSchema } from "~/lib/tori/validators";
import { isValidImageUrl } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

function validateImages(images: Array<{ url: string }>) {
	for (const img of images) {
		if (!isValidImageUrl(img.url)) {
			throw new AppError("tori.invalid_image");
		}
	}
}

function getOwnerId(session: Awaited<ReturnType<typeof getSession>>): string {
	if (!session) {
		throw new AppError("auth.unauthorized");
	}
	return session.user.id;
}

export const createToriItem = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-create", 10, 3600))
	.inputValidator(toriItemFormSchema)
	.handler(async ({ data }) => {
		const ownerId = getOwnerId(await getSession());
		const db = await getDb();

		validateImages(data.images);

		const id = crypto.randomUUID();
		const shortId = generateShortId();
		const expiresAt = new Date(Date.now() + TORI_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

		await db
			.insertInto("tori_item")
			.values({
				id,
				short_id: shortId,
				owner_id: ownerId,
				title: data.title,
				category: data.category,
				condition: data.condition,
				price_cents: eurosToCents(data.price),
				description: data.description,
				city: data.city,
				region: data.region,
				postal_code: data.postal_code ?? null,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		if (data.images.length > 0) {
			await db
				.insertInto("tori_item_image")
				.values(
					data.images.map((img, i) => ({
						id: crypto.randomUUID(),
						item_id: id,
						url: img.url,
						thumbnail_url: img.thumbnail_url ?? null,
						order: i,
					})),
				)
				.execute();
		}

		return { id, shortId };
	});

export const updateToriItem = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-update", 20, 3600))
	.inputValidator((input: { id: string; data: unknown }) => {
		const data = toriItemFormSchema.parse(input.data);
		return { id: input.id, data };
	})
	.handler(async ({ data: { id, data } }) => {
		const ownerId = getOwnerId(await getSession());
		const db = await getDb();

		validateImages(data.images);

		const existing = await db
			.selectFrom("tori_item")
			.select(["owner_id"])
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
				.updateTable("tori_item")
				.set({
					title: data.title,
					category: data.category,
					condition: data.condition,
					price_cents: eurosToCents(data.price),
					description: data.description,
					city: data.city,
					region: data.region,
					postal_code: data.postal_code ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();

			await trx.deleteFrom("tori_item_image").where("item_id", "=", id).execute();

			if (data.images.length > 0) {
				await trx
					.insertInto("tori_item_image")
					.values(
						data.images.map((img, i) => ({
							id: crypto.randomUUID(),
							item_id: id,
							url: img.url,
							thumbnail_url: img.thumbnail_url ?? null,
							order: i,
						})),
					)
					.execute();
			}
		});
	});

export const setToriItemStatus = createServerFn({ method: "POST" })
	.middleware(protectedMutation("tori-status", 30, 3600))
	.inputValidator((input: { id: string; status: string }) => {
		const allowed: ToriItemStatus[] = ["active", "paused", "sold"];
		if (!allowed.includes(input.status as ToriItemStatus)) {
			throw new Error("Invalid status");
		}
		return { id: input.id, status: input.status as ToriItemStatus };
	})
	.handler(async ({ data: { id, status } }) => {
		const ownerId = getOwnerId(await getSession());
		const db = await getDb();

		const item = await db
			.selectFrom("tori_item")
			.select(["owner_id"])
			.where("id", "=", id)
			.executeTakeFirst();

		if (!item || item.owner_id !== ownerId) {
			throw new AppError("tori.forbidden");
		}

		const updates: Record<string, unknown> = { status, updated_at: new Date() };
		if (status === "active") {
			updates.expires_at = new Date(Date.now() + TORI_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
		}

		await db.updateTable("tori_item").set(updates).where("id", "=", id).execute();
	});
