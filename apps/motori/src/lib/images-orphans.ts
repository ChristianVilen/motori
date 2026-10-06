// biome-ignore-all lint/suspicious/noConsole: CLI script — console output is expected
import {
	getImageStorage,
	type ImageStorage,
	type StoredObject,
} from "@motori/server/image-storage";
import { db } from "~/lib/db/index";
import { withLogContext } from "~/lib/log";

const MIN_AGE_MS = 24 * 60 * 60 * 1000;

function expectedCount(): number | null {
	const i = process.argv.indexOf("--expect");
	const value = i === -1 ? undefined : process.argv[i + 1];
	return value && /^\d+$/.test(value) ? Number(value) : null;
}

function refuseReason(urlMismatch: boolean, expected: number | null, found: number): string | null {
	if (urlMismatch) {
		return "the database URLs do not match the storage URLs.";
	}
	if (expected === found) {
		return null;
	}
	const check = "Run the dry run again and check the list.";
	return expected === null
		? `--expect <N> is missing. Found ${found} orphans. ${check}`
		: `found ${found} orphans, expected ${expected}. ${check}`;
}

async function deleteAll(storage: ImageStorage, orphans: StoredObject[]): Promise<number> {
	let failed = 0;
	for (const o of orphans) {
		try {
			await storage.delete(o.url);
		} catch (err) {
			failed++;
			console.error(`Failed to delete ${o.url}: ${err instanceof Error ? err.message : err}`);
		}
	}
	return failed;
}

await withLogContext({ script: "images-orphans" }, async () => {
	try {
		const shouldDelete = process.argv.includes("--delete");
		const expected = expectedCount();
		const storage = getImageStorage();

		const objects = await storage.list("listings/");
		const rows = await db.selectFrom("listing_image").select(["url", "thumbnail_url"]).execute();
		const referenced = new Set<string>();
		for (const row of rows) {
			referenced.add(row.url);
			if (row.thumbnail_url) {
				referenced.add(row.thumbnail_url);
			}
		}

		const listed = new Set(objects.map((o) => o.url));
		const cutoff = Date.now() - MIN_AGE_MS;
		const unreferenced = objects.filter((o) => !referenced.has(o.url));
		const orphans = unreferenced.filter((o) => o.lastModified.getTime() < cutoff);
		// Seed data and static /images/ URLs are not storage objects.
		const storageRefs = [...referenced].filter((url) => url.includes("/listings/"));
		const missing = storageRefs.filter((url) => !listed.has(url)).length;
		const urlMismatch = missing > 0 && missing >= storageRefs.length / 2;

		for (const o of orphans) {
			console.log(o.url);
		}
		console.log(`Listed under listings/: ${objects.length}`);
		console.log(`Referenced by the database: ${referenced.size}`);
		console.log(`Orphans: ${orphans.length}`);
		console.log(`Skipped, younger than 24 h: ${unreferenced.length - orphans.length}`);
		console.log(`Referenced but not found in storage: ${missing}`);
		if (urlMismatch) {
			console.log(
				"Hint: many database URLs are not in storage. The URLs may not match. Do not delete.",
			);
		}

		if (!shouldDelete) {
			console.log(
				`Dry run, nothing deleted. To delete these ${orphans.length} objects: pnpm images:orphans --delete --expect ${orphans.length}`,
			);
			return;
		}
		const refusal = refuseReason(urlMismatch, expected, orphans.length);
		if (refusal) {
			console.log(`Refusing to delete: ${refusal}`);
			process.exitCode = 1;
			return;
		}

		const failed = await deleteAll(storage, orphans);
		console.log(`Deleted: ${orphans.length - failed}`);
		if (failed > 0) {
			console.log(`Failed: ${failed}`);
			process.exitCode = 1;
		}
	} finally {
		await db.destroy();
	}
});
