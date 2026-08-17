import { describe, expect, it } from "vitest";
import { LISTING_EXPIRY_DAYS } from "~/lib/constants";
import { AppError } from "~/lib/errors";
import { buildStatusUpdate } from "~/lib/listings-commands";

const now = new Date("2026-08-17T12:00:00Z");

describe("buildStatusUpdate", () => {
	it("allows sold for sale, gear, and part", () => {
		for (const category of ["sale", "gear", "part"] as const) {
			const update = buildStatusUpdate(category, "sold", now);
			expect(update.status).toBe("sold");
			expect(update).not.toHaveProperty("expires_at");
			expect(update).not.toHaveProperty("expiry_notified_at");
		}
	});

	it("rejects sold for rental", () => {
		expect(() => buildStatusUpdate("rental", "sold", now)).toThrow(AppError);
	});

	it("re-activation resets the expiry clock", () => {
		const update = buildStatusUpdate("sale", "active", now);
		expect(update.status).toBe("active");
		expect(update.expires_at).toEqual(
			new Date(now.getTime() + LISTING_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
		);
		expect(update.expiry_notified_at).toBeNull();
	});

	it("paused and removed leave the expiry fields alone", () => {
		for (const status of ["paused", "removed"] as const) {
			const update = buildStatusUpdate("sale", status, now);
			expect(update.status).toBe(status);
			expect(update).not.toHaveProperty("expires_at");
			expect(update).not.toHaveProperty("expiry_notified_at");
		}
	});

	it("rejects statuses outside the whitelist at runtime", () => {
		expect(() => buildStatusUpdate("sale", "expired" as never, now)).toThrow(AppError);
		expect(() => buildStatusUpdate("sale", "nonsense" as never, now)).toThrow(AppError);
	});
});
