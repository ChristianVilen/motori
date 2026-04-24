// src/lib/delete-account.ts
// Right-to-erasure: delete all user data (listings, images, favorites, profile, auth).

import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createServerFn } from "@tanstack/react-start";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { getSession } from "~/lib/session";
import { getStorageClient } from "~/lib/storage";

async function deleteUserImages(userId: string) {
	if (!process.env.STORAGE_ENDPOINT) {
		return;
	}
	const client = getStorageClient();
	const bucket = process.env.STORAGE_BUCKET;
	const prefix = `listings/${userId}/`;

	let continuationToken: string | undefined;
	do {
		const list = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: continuationToken,
			}),
		);
		const keys = list.Contents?.map((o) => o.Key).filter(Boolean) as string[] | undefined;
		if (keys?.length) {
			await client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: keys.map((Key) => ({ Key })) },
				}),
			);
		}
		continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
	} while (continuationToken);
}

export const deleteAccount = createServerFn({ method: "POST" })
	.middleware([rateLimitMiddleware(3, 60, "delete-account")])
	.handler(async () => {
		const session = await getSession();
		if (!session) {
			throw new Error("Ei istuntoa");
		}
		const userId = session.user.id;
		const userEmail = session.user.email;

		// Delete S3 images (best-effort — don't block account deletion on storage failure)
		try {
			await deleteUserImages(userId);
		} catch {
			log.warn("Failed to delete S3 images during account deletion", { userId });
		}

		// Delete all DB data in a transaction
		await db.transaction().execute(async (trx) => {
			// App tables (explicit deletes before cascade for clarity and S3 key lookup)
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
