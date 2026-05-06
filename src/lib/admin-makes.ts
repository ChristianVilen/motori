import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { requireAdmin } from "~/lib/admin";
import { db } from "~/lib/db/index";
import { invalidateMakesCache } from "~/lib/makes";
import { csrfOnly } from "~/lib/middleware";
import { slugify } from "~/lib/slug";

export interface AdminMake {
	id: string;
	name: string;
	slug: string;
	listingCount: number;
	modelCount: number;
	createdAt: Date;
}

export interface AdminModel {
	id: string;
	name: string;
	makeId: string;
	makeName: string;
	listingCount: number;
	createdAt: Date;
}

export const getAdminMakes = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdmin();
	const rows = await db
		.selectFrom("motorcycle_make as mk")
		.leftJoin("motorcycle_model as mo", "mo.make_id", "mk.id")
		.leftJoin("listing as l", "l.make_id", "mk.id")
		.select([
			"mk.id",
			"mk.name",
			"mk.slug",
			"mk.created_at as createdAt",
			sql<number>`count(distinct mo.id)::int`.as("modelCount"),
			sql<number>`count(distinct l.id)::int`.as("listingCount"),
		])
		.groupBy(["mk.id", "mk.name", "mk.slug", "mk.created_at"])
		.orderBy("mk.name", "asc")
		.execute();
	return rows as AdminMake[];
});

export const getAdminModels = createServerFn({ method: "GET" })
	.inputValidator((makeId: string | null) => makeId)
	.handler(async ({ data: makeId }) => {
		await requireAdmin();
		let query = db
			.selectFrom("motorcycle_model as mo")
			.innerJoin("motorcycle_make as mk", "mk.id", "mo.make_id")
			.leftJoin("listing as l", "l.model_id", "mo.id")
			.select([
				"mo.id",
				"mo.name",
				"mo.make_id as makeId",
				"mk.name as makeName",
				"mo.created_at as createdAt",
				sql<number>`count(distinct l.id)::int`.as("listingCount"),
			])
			.groupBy(["mo.id", "mo.name", "mo.make_id", "mk.name", "mo.created_at"])
			.orderBy("mk.name", "asc")
			.orderBy("mo.name", "asc");
		if (makeId) {
			query = query.where("mo.make_id", "=", makeId);
		}
		const rows = await query.execute();
		return rows as AdminModel[];
	});

export const renameMake = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((data: { id: string; name: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = data.name.trim();
		if (!name) {
			throw new Error("Name cannot be empty");
		}
		await db
			.updateTable("motorcycle_make")
			.set({ name, slug: slugify(name) })
			.where("id", "=", data.id)
			.execute();
		invalidateMakesCache();
	});

export const renameModel = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((data: { id: string; name: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = data.name.trim();
		if (!name) {
			throw new Error("Name cannot be empty");
		}
		await db.updateTable("motorcycle_model").set({ name }).where("id", "=", data.id).execute();
	});

export const deleteMake = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		await requireAdmin();
		const row = await db
			.selectFrom("motorcycle_make as mk")
			.leftJoin("motorcycle_model as mo", "mo.make_id", "mk.id")
			.leftJoin("listing as l", "l.make_id", "mk.id")
			.select([
				sql<number>`count(distinct mo.id)::int`.as("modelCount"),
				sql<number>`count(distinct l.id)::int`.as("listingCount"),
			])
			.where("mk.id", "=", id)
			.groupBy("mk.id")
			.executeTakeFirst();
		if (row && (row.modelCount > 0 || row.listingCount > 0)) {
			throw new Error("Cannot delete a make that has models or listings");
		}
		await db.deleteFrom("motorcycle_make").where("id", "=", id).execute();
		invalidateMakesCache();
	});

export const deleteModel = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((id: string) => id)
	.handler(async ({ data: id }) => {
		await requireAdmin();
		const row = await db
			.selectFrom("motorcycle_model as mo")
			.leftJoin("listing as l", "l.model_id", "mo.id")
			.select(sql<number>`count(distinct l.id)::int`.as("listingCount"))
			.where("mo.id", "=", id)
			.groupBy("mo.id")
			.executeTakeFirst();
		if (row && row.listingCount > 0) {
			throw new Error("Cannot delete a model that has listings");
		}
		await db.deleteFrom("motorcycle_model").where("id", "=", id).execute();
	});

export const mergeMakes = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((data: { sourceId: string; targetId: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		if (data.sourceId === data.targetId) {
			throw new Error("Cannot merge a make into itself");
		}
		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({ make_id: data.targetId, updated_at: new Date() })
				.where("make_id", "=", data.sourceId)
				.execute();
			await trx
				.updateTable("motorcycle_model")
				.set({ make_id: data.targetId })
				.where("make_id", "=", data.sourceId)
				.execute();
			await trx.deleteFrom("motorcycle_make").where("id", "=", data.sourceId).execute();
		});
		invalidateMakesCache();
	});

export const mergeModels = createServerFn({ method: "POST" })
	.middleware(csrfOnly())
	.inputValidator((data: { sourceId: string; targetId: string }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		if (data.sourceId === data.targetId) {
			throw new Error("Cannot merge a model into itself");
		}
		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({ model_id: data.targetId, updated_at: new Date() })
				.where("model_id", "=", data.sourceId)
				.execute();
			await trx.deleteFrom("motorcycle_model").where("id", "=", data.sourceId).execute();
		});
	});
