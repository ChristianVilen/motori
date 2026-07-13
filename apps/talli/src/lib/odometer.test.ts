import { describe, expect, it } from "vitest";
import { applyOdometerReading } from "./odometer";

describe("applyOdometerReading", () => {
	it("bumps the vehicle odometer when the reading is higher", () => {
		expect(applyOdometerReading(12000, 12500)).toBe(12500);
	});

	it("keeps the vehicle odometer when the reading is lower (backfilled old entry)", () => {
		expect(applyOdometerReading(12000, 11000)).toBe(12000);
	});

	it("keeps the vehicle odometer on an equal reading", () => {
		expect(applyOdometerReading(12000, 12000)).toBe(12000);
	});
});
