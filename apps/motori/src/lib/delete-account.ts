// src/lib/delete-account.ts
// Right-to-erasure: delete all user data (listings, images, favorites, profile, auth).

import { csrfMiddleware } from "@motori/server/csrf";
import { rateLimitMiddleware } from "@motori/server/rate-limit";
import { createServerFn } from "@tanstack/react-start";
import { db } from "~/lib/db/index";
import { getImageStorage } from "~/lib/image-storage";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { getSession } from "~/lib/session";

export const deleteAccount = createServerFn({ method: "POST" })
	.middleware([csrfMiddleware(), rateLimitMiddleware(3, 60, "delete-account")])
	.handler(async () => {
		const session = await getSession();
		if (!session) {
			throw new Error("Ei istuntoa");
		}
		const userId = session.user.id;
		const userEmail = session.user.email;

		// Delete images (best-effort — don't block account deletion on storage failure)
		try {
			await getImageStorage().deleteByPrefix(`listings/${userId}/`);
		} catch {
			log.warn("Failed to delete images during account deletion", { userId });
		}

		// Delete all DB data in a transaction
		await db.transaction().execute(async (trx) => {
			// App tables (explicit deletes before cascade for clarity)
			const listingIds = await trx
				.selectFrom("listing")
				.select("id")
				.where("owner_id", "=", userId)
				.execute();

			if (listingIds.length) {
				const ids = listingIds.map((r) => r.id);
				await trx.deleteFrom("listing_image").where("listing_id", "in", ids).execute();
			}
			await trx.deleteFrom("favorite").where("user_id", "=", userId).execute();
			await trx.deleteFrom("listing").where("owner_id", "=", userId).execute();
			await trx.deleteFrom("profile").where("user_id", "=", userId).execute();

			// BetterAuth tables
			await trx.deleteFrom("verification").where("identifier", "=", userEmail).execute();
			await trx.deleteFrom("session").where("userId", "=", userId).execute();
			await trx.deleteFrom("account").where("userId", "=", userId).execute();
			await trx.deleteFrom("user").where("id", "=", userId).execute();
		});

		log.event(EVENTS.account.deleted, { userId });
		return { success: true };
	});
