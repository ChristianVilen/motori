import { createServerFn } from "@tanstack/react-start";
import { hasCategoryMap } from "~/lib/constants";
import { protectedMutation } from "~/lib/middleware";
import { deleteSavedSearch, getSavedSearches, saveSearch } from "~/lib/saved-searches";
import { requireUserId } from "~/lib/session";
import {
	savedAllSearchParamsSchema,
	savedListSearchParamsSchema,
	savedSearchParamsSchema,
} from "~/lib/validators";
import { z } from "~/lib/zod";

const categorySchema = z.enum(["all", "sale", "rental", "gear", "part"]);

export const saveSearchFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("save-search", 20, 60))
	.inputValidator((data: { category: string; params: unknown }) => {
		const category = categorySchema.parse(data.category);
		const schema =
			category === "all"
				? savedAllSearchParamsSchema
				: hasCategoryMap(category)
					? savedSearchParamsSchema
					: savedListSearchParamsSchema;
		return { category, params: schema.parse(data.params) };
	})
	.handler(async ({ data }) => saveSearch(await requireUserId(), data.category, data.params));

export const deleteSavedSearchFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("delete-saved-search", 20, 60))
	.inputValidator((data: { id: string }) => {
		if (typeof data?.id !== "string" || data.id.length === 0) {
			throw new Error("Invalid id");
		}
		return data;
	})
	.handler(async ({ data }) => deleteSavedSearch(await requireUserId(), data.id));

export const getSavedSearchesFn = createServerFn({ method: "GET" }).handler(async () =>
	getSavedSearches(await requireUserId()),
);
