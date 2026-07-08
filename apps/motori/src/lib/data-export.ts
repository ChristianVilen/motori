import { csrfMiddleware } from "@motori/server/csrf";
import { rateLimitMiddleware } from "@motori/server/rate-limit";
import { createServerFn } from "@tanstack/react-start";
import { db } from "~/lib/db/index";
import { getSession } from "~/lib/session";

const bookingExportColumns = [
	"id",
	"short_id",
	"listing_id",
	"start_date",
	"end_date",
	"message",
	"status",
	"rejection_reason",
	"responded_at",
	"created_at",
] as const;

export const exportMyData = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware(), rateLimitMiddleware(3, 60, "data-export")])
	.handler(async () => {
		const session = await getSession();
		if (!session) {
			throw new Error("Ei istuntoa");
		}
		const userId = session.user.id;

		const [user, profile, listings, favorites, bookingsAsRenter, reports] = await Promise.all([
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
					"short_id",
					"category",
					"title",
					"make_id",
					"model_id",
					"year",
					"engine_cc",
					"required_license",
					"motorcycle_type",
					"city",
					"region",
					"postal_code",
					"description",
					"status",
					"view_count",
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
			db
				.selectFrom("booking")
				.select([...bookingExportColumns])
				.where("renter_user_id", "=", userId)
				.execute(),
			db
				.selectFrom("report")
				.select(["id", "target_type", "target_id", "reason", "status", "created_at"])
				.where("reporter_id", "=", userId)
				.execute(),
		]);

		const listingIds = listings.map((l) => l.id);

		const [listingImages, bookingsAsOwner, availabilityExceptions] =
			listingIds.length > 0
				? await Promise.all([
						db
							.selectFrom("listing_image")
							.select(["listing_id", "url", "thumbnail_url", "order"])
							.where("listing_id", "in", listingIds)
							.execute(),
						db
							.selectFrom("booking")
							.select([...bookingExportColumns])
							.where("listing_id", "in", listingIds)
							.execute(),
						db
							.selectFrom("listing_availability_exception")
							.select(["listing_id", "date"])
							.where("listing_id", "in", listingIds)
							.execute(),
					])
				: [[], [], []];

		return {
			exported_at: new Date().toISOString(),
			user: user ?? null,
			profile: profile ?? null,
			listings,
			listing_images: listingImages,
			availability_exceptions: availabilityExceptions,
			bookings_as_renter: bookingsAsRenter,
			bookings_as_owner: bookingsAsOwner,
			favorites,
			reports,
		};
	});
