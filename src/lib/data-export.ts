import { createServerFn } from "@tanstack/react-start";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { getSession } from "~/lib/session";

export const exportMyData = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware(), rateLimitMiddleware(3, 60, "data-export")])
	.handler(async () => {
		const session = await getSession();
		if (!session) {
			throw new Error("Ei istuntoa");
		}
		const userId = session.user.id;

		const [user, profile, listings, favorites] = await Promise.all([
			db
				.selectFrom("user")
				.select(["name", "email", "emailVerified", "createdAt"])
				.where("id", "=", userId)
				.executeTakeFirst(),
			db.selectFrom("profile").selectAll().where("user_id", "=", userId).executeTakeFirst(),
			db
				.selectFrom("listing")
				.select([
					"id",
					"title",
					"make_id",
					"model_id",
					"year",
					"engine_cc",
					"required_license",
					"motorcycle_type",
					"price_per_day",
					"price_per_week",
					"price_description",
					"city",
					"region",
					"postal_code",
					"description",
					"mileage_limit",
					"status",
					"created_at",
					"updated_at",
				])
				.where("owner_id", "=", userId)
				.execute(),
			db
				.selectFrom("favorite")
				.select(["listing_id", "created_at"])
				.where("user_id", "=", userId)
				.execute(),
		]);

		return {
			exported_at: new Date().toISOString(),
			user: user ?? null,
			profile: profile ?? null,
			listings,
			favorites,
		};
	});
