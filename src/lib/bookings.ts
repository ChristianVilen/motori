import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateBookingShortId(): string {
	const bytes = randomBytes(8);
	let out = "";
	for (let i = 0; i < 8; i++) {
		out += BASE62[bytes[i] % 62];
	}
	return out;
}

/** Expand inclusive YYYY-MM-DD range to an array of YYYY-MM-DD strings. */
export function expandDateRange(start: string, end: string): string[] {
	if (end < start) {
		throw new Error(`end (${end}) is before start (${start})`);
	}
	const result: string[] = [];
	const cursor = new Date(`${start}T00:00:00Z`);
	const stop = new Date(`${end}T00:00:00Z`);
	while (cursor <= stop) {
		result.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return result;
}
