import { createServerFn } from "@tanstack/react-start";
import { db } from "~/lib/db/index";
import { getSession } from "~/lib/session";

export function toSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

export const getMakes = createServerFn({ method: "GET" }).handler(() => {
	return db
		.selectFrom("motorcycle_make")
		.select(["id", "name", "slug"])
		.orderBy("name", "asc")
		.execute();
});

export const getModels = createServerFn({ method: "GET" })
	.inputValidator((makeId: string) => makeId)
	.handler(({ data: makeId }) => {
		return db
			.selectFrom("motorcycle_model")
			.select(["id", "name"])
			.where("make_id", "=", makeId)
			.orderBy("name", "asc")
			.execute();
	});

export const createMake = createServerFn({ method: "POST" })
	.inputValidator((name: string) => name)
	.handler(async ({ data: name }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}
		const trimmedName = name.trim();
		return db
			.insertInto("motorcycle_make")
			.values({ id: crypto.randomUUID(), name: trimmedName, slug: toSlug(trimmedName) })
			.returningAll()
			.executeTakeFirstOrThrow();
	});

export const createModel = createServerFn({ method: "POST" })
	.inputValidator((data: { makeId: string; name: string }) => data)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new Error("Kirjaudu sisään");
		}
		return db
			.insertInto("motorcycle_model")
			.values({ id: crypto.randomUUID(), make_id: data.makeId, name: data.name.trim() })
			.returningAll()
			.executeTakeFirstOrThrow();
	});
