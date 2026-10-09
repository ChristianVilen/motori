import { getImageStorage } from "@motori/server/image-storage";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";

// An admin can restore a removed listing and messages still show its thumbnail, so
// removed listings keep their images for a while.
const REMOVED_IMAGE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type ImageRow = { url: string; thumbnail_url?: string | null };

function storageKey(url: string): string | null {
	const localPrefix = "/api/uploads/";
	if (url.startsWith(localPrefix)) {
		return url.slice(localPrefix.length);
	}
	const publicUrl = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "");
	if (publicUrl && url.startsWith(`${publicUrl}/`)) {
		return url.slice(publicUrl.length + 1);
	}
	return null;
}

// isValidImageUrl does not tie a URL to its owner, so a crafted edit can store someone
// else's photo URL. Only keys under listings/<ownerId>/ are ever safe to delete.
function isOwnedListingKey(key: string, ownerId: string): boolean {
	const parts = key.split("/");
	if (parts.length !== 3) {
		return false;
	}
	const [dir, owner, name] = parts;
	return dir === "listings" && !!ownerId && owner === ownerId && !!name && !name.includes("..");
}

export function imageObjectsToDelete(
	oldRows: readonly ImageRow[],
	newRows: readonly ImageRow[],
	ownerId: string,
): string[] {
	const urlsOf = (rows: readonly ImageRow[]) =>
		rows.flatMap((r) => (r.thumbnail_url ? [r.url, r.thumbnail_url] : [r.url]));
	const kept = new Set(urlsOf(newRows));
	const removed = new Set(urlsOf(oldRows).filter((url) => !kept.has(url)));
	return [...removed].filter((url) => {
		const key = storageKey(url);
		return key !== null && isOwnedListingKey(key, ownerId);
	});
}

export async function deleteImageObjects(
	urls: readonly string[],
	listingId: string,
): Promise<number> {
	let failed = 0;
	for (const url of urls) {
		try {
			await getImageStorage().delete(url);
		} catch (err) {
			failed++;
			log.warn("listing image delete failed", { listingId, url, err });
		}
	}
	return failed;
}

export async function purgeRemovedListingImages(): Promise<{
	listings: number;
	objects: number;
	rows: number;
	failedListings: number;
}> {
	const cutoff = new Date(Date.now() - REMOVED_IMAGE_RETENTION_MS);
	const found = await db
		.selectFrom("listing_image")
		.innerJoin("listing", "listing.id", "listing_image.listing_id")
		.select([
			"listing_image.id",
			"listing_image.listing_id",
			"listing_image.url",
			"listing_image.thumbnail_url",
			"listing.owner_id",
		])
		.where("listing.status", "=", "removed")
		.where("listing.updated_at", "<", cutoff)
		.execute();

	const byListing = new Map<string, { ownerId: string; rows: typeof found }>();
	for (const r of found) {
		const group = byListing.get(r.listing_id);
		if (group) {
			group.rows.push(r);
		} else {
			byListing.set(r.listing_id, { ownerId: r.owner_id, rows: [r] });
		}
	}

	const rowIds: string[] = [];
	let listings = 0;
	let objects = 0;
	let failedListings = 0;
	for (const [listingId, { ownerId, rows }] of byListing) {
		const urls = imageObjectsToDelete(rows, [], ownerId);
		if ((await deleteImageObjects(urls, listingId)) > 0) {
			failedListings++;
			continue;
		}
		rowIds.push(...rows.map((r) => r.id));
		listings++;
		objects += urls.length;
	}

	let deletedRows = 0;
	if (rowIds.length > 0) {
		const result = await db
			.deleteFrom("listing_image")
			.where("id", "in", rowIds)
			.executeTakeFirst();
		deletedRows = Number(result.numDeletedRows);
	}
	return { listings, objects, rows: deletedRows, failedListings };
}
