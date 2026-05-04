import { createServerFn } from "@tanstack/react-start";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";

export function toSlug(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

type MakeRow = { id: string; name: string; slug: string };
let makesCache: { data: MakeRow[]; expiresAt: number } | null = null;
const MAKES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getMakes = createServerFn({ method: "GET" }).handler(() => {
	if (makesCache && Date.now() < makesCache.expiresAt) {
		return makesCache.data;
	}
	return db
		.selectFrom("motorcycle_make")
		.select(["id", "name", "slug"])
		.orderBy("name", "asc")
		.execute()
		.then((rows) => {
			makesCache = { data: rows, expiresAt: Date.now() + MAKES_CACHE_TTL };
			return rows;
		});
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

const MAX_NAME_LENGTH = 100;

export const createMake = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(10, 60, "create-make"),
		requireVerifiedEmail(),
	])
	.inputValidator((name: string) => name)
	.handler(async ({ data: name }) => {
		const trimmedName = name.trim();
		if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
			throw new Error("Merkin nimi on liian pitkä tai tyhjä");
		}
		const result = await db
			.insertInto("motorcycle_make")
			.values({ id: crypto.randomUUID(), name: trimmedName, slug: toSlug(trimmedName) })
			.returningAll()
			.executeTakeFirstOrThrow();
		makesCache = null;
		return result;
	});

export const createModel = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(10, 60, "create-model"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: { makeId: string; name: string }) => data)
	.handler(async ({ data }) => {
		const trimmedName = data.name.trim();
		if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
			throw new Error("Mallin nimi on liian pitkä tai tyhjä");
		}
		return db
			.insertInto("motorcycle_model")
			.values({ id: crypto.randomUUID(), make_id: data.makeId, name: trimmedName })
			.returningAll()
			.executeTakeFirstOrThrow();
	});
