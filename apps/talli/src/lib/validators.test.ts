import { describe, expect, it } from "vitest";
import { reminderFormSchema } from "./validators";

// Exercises the mmdd anchor schema through reminderFormSchema (its exported user).
const parseAnchor = (anchor: string) =>
	reminderFormSchema.safeParse({
		vehicle_id: "00000000-0000-0000-0000-000000000000",
		type: "date",
		title: "Vakuutus",
		recurrence_dates: [anchor],
	}).success;

describe("mmdd recurrence anchors", () => {
	it.each(["01-01", "12-31", "04-30", "02-28"])("accepts %s", (anchor) => {
		expect(parseAnchor(anchor)).toBe(true);
	});

	it.each([
		"02-29", // leap day rejected by design — no leap-day anchors
		"02-30",
		"02-31",
		"04-31",
		"06-31",
		"09-31",
		"11-31",
		"00-10",
		"13-01",
		"01-32",
	])("rejects %s", (anchor) => {
		expect(parseAnchor(anchor)).toBe(false);
	});
});
