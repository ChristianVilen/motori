import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ImageStorage } from "@motori/server/image-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeQueue, executeTakeFirstQueue, resetDbMock, whereCalls } from "~/test/kysely-mock";

const holder = vi.hoisted(() => ({ storage: null as unknown }));

vi.mock("@motori/server/image-storage", () => ({
	getImageStorage: () => holder.storage,
}));

vi.mock("~/lib/db/index", async () => (await import("~/test/kysely-mock")).dbModuleMock());

vi.mock("~/lib/log", () => ({
	log: { event: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	withLogContext: (_ctx: unknown, fn: () => unknown) => fn(),
}));

import { imageObjectsToDelete, purgeRemovedListingImages } from "./listing-images.server";

const row = (name: string, owner = "u1", prefix = "/api/uploads/listings") => ({
	url: `${prefix}/${owner}/${name}.webp`,
	thumbnail_url: `${prefix}/${owner}/${name}_thumb.webp`,
});

const R2 = "https://images.example.test";
const originalPublicUrl = process.env.STORAGE_PUBLIC_URL;

beforeEach(() => {
	delete process.env.STORAGE_PUBLIC_URL;
});

afterEach(() => {
	if (originalPublicUrl === undefined) {
		delete process.env.STORAGE_PUBLIC_URL;
	} else {
		process.env.STORAGE_PUBLIC_URL = originalPublicUrl;
	}
});

describe("imageObjectsToDelete", () => {
	const a = row("a");
	const b = row("b");
	const c = row("c");

	it("returns nothing when nothing changed", () => {
		expect(imageObjectsToDelete([a, b], [a, b], "u1")).toEqual([]);
	});

	it("returns nothing when only the order changed", () => {
		expect(imageObjectsToDelete([a, b, c], [c, a, b], "u1")).toEqual([]);
	});

	it("returns nothing when an image is added", () => {
		expect(imageObjectsToDelete([a], [a, b], "u1")).toEqual([]);
	});

	it("returns url and thumbnail of a removed image", () => {
		expect(imageObjectsToDelete([a, b, c], [a, c], "u1")).toEqual([b.url, b.thumbnail_url]);
	});

	it("returns everything when all images are removed", () => {
		expect(imageObjectsToDelete([a, b], [], "u1")).toEqual([
			a.url,
			a.thumbnail_url,
			b.url,
			b.thumbnail_url,
		]);
	});

	it("returns only the url when thumbnail_url is null", () => {
		const old = { url: a.url, thumbnail_url: null };
		expect(imageObjectsToDelete([old], [], "u1")).toEqual([a.url]);
	});

	it("returns only the removed image when one is removed and one added", () => {
		expect(imageObjectsToDelete([a, b], [a, c], "u1")).toEqual([b.url, b.thumbnail_url]);
	});

	it("returns a duplicated url once", () => {
		expect(imageObjectsToDelete([a, a], [], "u1")).toEqual([a.url, a.thumbnail_url]);
	});

	it("keeps an object that a new row still uses as its thumbnail", () => {
		const reused = { url: c.url, thumbnail_url: a.url };
		expect(imageObjectsToDelete([a], [reused], "u1")).toEqual([a.thumbnail_url]);
	});

	it("handles R2 urls and ignores a trailing slash in STORAGE_PUBLIC_URL", () => {
		process.env.STORAGE_PUBLIC_URL = `${R2}/`;
		const r = row("a", "u1", `${R2}/listings`);
		expect(imageObjectsToDelete([r], [], "u1")).toEqual([r.url, r.thumbnail_url]);
	});

	describe("ownership guard", () => {
		beforeEach(() => {
			process.env.STORAGE_PUBLIC_URL = R2;
		});

		const rejected: Record<string, string> = {
			"another user's key (local)": "/api/uploads/listings/u2/a.webp",
			"another user's key (R2)": `${R2}/listings/u2/a.webp`,
			"talli key": `${R2}/talli/u1/a.webp`,
			"talli key (local)": "/api/uploads/talli/u1/a.webp",
			"foreign host": "https://evil.example.test/listings/u1/a.webp",
			"traversal in name": `${R2}/listings/u1/..a.webp`,
			"traversal segment": "/api/uploads/listings/u1/../u2/a.webp",
			"deeper path": `${R2}/listings/u1/x/y.webp`,
			"empty name": `${R2}/listings/u1/`,
			"owner id as prefix only": `${R2}/listings/u10/a.webp`,
		};

		for (const [label, url] of Object.entries(rejected)) {
			it(`never returns ${label}`, () => {
				expect(imageObjectsToDelete([{ url, thumbnail_url: url }], [], "u1")).toEqual([]);
			});
		}

		it("never matches an empty owner id", () => {
			const url = `${R2}/listings//x.webp`;
			expect(imageObjectsToDelete([{ url, thumbnail_url: url }], [], "")).toEqual([]);
		});

		it("still returns the owner's objects next to rejected ones", () => {
			const mine = row("a", "u1", `${R2}/listings`);
			const foreign = { url: `${R2}/listings/u2/a.webp` };
			expect(imageObjectsToDelete([foreign, mine], [], "u1")).toEqual([
				mine.url,
				mine.thumbnail_url,
			]);
		});
	});
});

describe("purgeRemovedListingImages", () => {
	const NOW = new Date("2026-10-06T12:00:00Z");
	let root: string;
	let storage: ImageStorage;

	const filePath = (url: string) => path.join(root, url.replace("/api/uploads/", ""));
	const writeFiles = async (r: { url: string; thumbnail_url: string }) => {
		for (const url of [r.url, r.thumbnail_url]) {
			await fs.mkdir(path.dirname(filePath(url)), { recursive: true });
			await fs.writeFile(filePath(url), "x");
		}
	};
	const exists = (url: string) =>
		fs.access(filePath(url)).then(
			() => true,
			() => false,
		);
	const dbRow = (id: string, listingId: string, owner: string, r: ReturnType<typeof row>) => ({
		id,
		listing_id: listingId,
		owner_id: owner,
		url: r.url,
		thumbnail_url: r.thumbnail_url,
	});

	beforeEach(async () => {
		vi.useFakeTimers({ toFake: ["Date"], now: NOW });
		resetDbMock();
		root = await fs.mkdtemp(path.join(os.tmpdir(), "motori-purge-"));
		const { LocalStorage } = await vi.importActual<typeof import("@motori/server/image-storage")>(
			"@motori/server/image-storage",
		);
		storage = new LocalStorage(root);
		holder.storage = storage;
	});

	afterEach(async () => {
		vi.useRealTimers();
		await fs.rm(root, { recursive: true, force: true });
	});

	it("deletes objects and rows of long-removed listings", async () => {
		const a = row("a");
		const b = row("b", "u2");
		await writeFiles(a);
		await writeFiles(b);
		executeQueue.push([dbRow("r1", "l1", "u1", a), dbRow("r2", "l2", "u2", b)]);
		executeTakeFirstQueue.push({ numDeletedRows: 2n });

		const result = await purgeRemovedListingImages();

		expect(result).toEqual({ listings: 2, objects: 4, rows: 2, failedListings: 0 });
		expect(await exists(a.url)).toBe(false);
		expect(await exists(a.thumbnail_url)).toBe(false);
		expect(await exists(b.url)).toBe(false);
		expect(await exists(b.thumbnail_url)).toBe(false);
		expect(whereCalls).toContainEqual(["listing.status", "=", "removed"]);
		const cutoff = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
		expect(whereCalls).toContainEqual(["listing.updated_at", "<", cutoff]);
		expect(whereCalls).toContainEqual(["id", "in", ["r1", "r2"]]);
	});

	it("deletes a row that points at another user's object but leaves the object", async () => {
		const mine = row("a");
		const foreign = row("f", "u2");
		await writeFiles(mine);
		await writeFiles(foreign);
		executeQueue.push([dbRow("r1", "l1", "u1", mine), dbRow("r2", "l1", "u1", foreign)]);
		executeTakeFirstQueue.push({ numDeletedRows: 2n });

		const result = await purgeRemovedListingImages();

		expect(result).toEqual({ listings: 1, objects: 2, rows: 2, failedListings: 0 });
		expect(await exists(mine.url)).toBe(false);
		expect(await exists(foreign.url)).toBe(true);
		expect(await exists(foreign.thumbnail_url)).toBe(true);
		expect(whereCalls).toContainEqual(["id", "in", ["r1", "r2"]]);
	});

	it("does nothing on a second run", async () => {
		const a = row("a");
		const kept = row("kept", "u2");
		await writeFiles(a);
		await writeFiles(kept);
		executeQueue.push([dbRow("r1", "l1", "u1", a)]);
		executeTakeFirstQueue.push({ numDeletedRows: 1n });

		const first = await purgeRemovedListingImages();

		expect(first).toEqual({ listings: 1, objects: 2, rows: 1, failedListings: 0 });
		expect(executeTakeFirstQueue).toHaveLength(0);
		expect(await exists(a.url)).toBe(false);

		executeQueue.push([]);
		executeTakeFirstQueue.push({ numDeletedRows: 99n });

		const second = await purgeRemovedListingImages();

		expect(second).toEqual({ listings: 0, objects: 0, rows: 0, failedListings: 0 });
		expect(executeTakeFirstQueue).toHaveLength(1);
		expect(await exists(kept.url)).toBe(true);
		expect(await exists(kept.thumbnail_url)).toBe(true);
	});

	it("keeps the rows of a listing whose delete failed and purges the others", async () => {
		const a = row("a");
		const b = row("b", "u2");
		await writeFiles(a);
		await writeFiles(b);
		executeQueue.push([dbRow("r1", "l1", "u1", a), dbRow("r2", "l2", "u2", b)]);
		executeTakeFirstQueue.push({ numDeletedRows: 1n });
		vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("boom"));

		const result = await purgeRemovedListingImages();

		expect(result).toEqual({ listings: 1, objects: 2, rows: 1, failedListings: 1 });
		expect(whereCalls).toContainEqual(["id", "in", ["r2"]]);
		expect(await exists(b.url)).toBe(false);
	});
});
