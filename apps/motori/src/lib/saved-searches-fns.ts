import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { protectedMutation } from "~/lib/middleware";
import { deleteSavedSearch, getSavedSearches, saveSearch } from "~/lib/saved-searches";
import { requireUserId } from "~/lib/session";
import { savedSearchParamsSchema } from "~/lib/validators";

const categorySchema = z.enum(["sale", "rental", "gear", "part"]);

export const saveSearchFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("save-search", 20, 60))
	.inputValidator((data: { category: string; params: unknown }) => ({
		category: categorySchema.parse(data.category),
		params: savedSearchParamsSchema.parse(data.params),
	}))
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
