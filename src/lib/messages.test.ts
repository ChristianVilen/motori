import { describe, expect, it } from "vitest";
import { shouldNotifyByEmail, validateMessageBody } from "./messages";

describe("validateMessageBody", () => {
	it("accepts a normal body", () => {
		expect(validateMessageBody("hello")).toBe("hello");
	});
	it("trims surrounding whitespace", () => {
		expect(validateMessageBody("  hi  ")).toBe("hi");
	});
	it("rejects empty after trim", () => {
		expect(() => validateMessageBody("   ")).toThrow();
	});
	it("rejects over 4000 chars", () => {
		expect(() => validateMessageBody("a".repeat(4001))).toThrow();
	});
});

describe("shouldNotifyByEmail", () => {
	const now = new Date("2026-05-14T10:00:00Z");
	const earlier = new Date("2026-05-14T09:00:00Z");
	const muchEarlier = new Date("2026-05-14T08:00:00Z");

	it("notifies when there is no prior message", () => {
		expect(shouldNotifyByEmail({ recipientLastReadAt: null, priorMessageCreatedAt: null })).toBe(
			true,
		);
	});
	it("notifies when recipient was caught up (lastRead >= prior.createdAt)", () => {
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: earlier, priorMessageCreatedAt: earlier }),
		).toBe(true);
		expect(shouldNotifyByEmail({ recipientLastReadAt: now, priorMessageCreatedAt: earlier })).toBe(
			true,
		);
	});
	it("suppresses when recipient still has an earlier unread message", () => {
		expect(
			shouldNotifyByEmail({ recipientLastReadAt: muchEarlier, priorMessageCreatedAt: earlier }),
		).toBe(false);
	});
	it("suppresses when recipient has never read and a prior message exists", () => {
		expect(shouldNotifyByEmail({ recipientLastReadAt: null, priorMessageCreatedAt: earlier })).toBe(
			false,
		);
	});
});
