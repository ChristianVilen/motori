import { createServerFn } from "@tanstack/react-start";
import { getFavoriteIds, getFavoriteListings, toggleFavorite } from "~/lib/favorites";
import { protectedMutation } from "~/lib/middleware";
import { getSession, requireUserId } from "~/lib/session";

export const toggleFavoriteFn = createServerFn({ method: "POST" })
	.middleware(protectedMutation("toggle-favorite", 30, 60))
	.inputValidator((data: { listingId: string }) => {
		if (typeof data?.listingId !== "string" || data.listingId.length === 0) {
			throw new Error("Invalid listingId");
		}
		return data;
	})
	.handler(async ({ data }) => toggleFavorite(await requireUserId(), data.listingId));

export const getFavoriteIdsFn = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) {
		return [] as string[];
	}
	return getFavoriteIds(session.user.id);
});

export const getFavoriteListingsFn = createServerFn({ method: "GET" }).handler(async () =>
	getFavoriteListings(await requireUserId()),
);
