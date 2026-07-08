import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("getClientIp", () => {
	it("extracts first IP from x-forwarded-for", () => {
		const req = new Request("http://localhost", {
			headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
		});
		expect(getClientIp(req)).toBe("1.2.3.4");
	});

	it("returns single IP when no comma", () => {
		const req = new Request("http://localhost", {
			headers: { "x-forwarded-for": "192.168.1.1" },
		});
		expect(getClientIp(req)).toBe("192.168.1.1");
	});

	it("returns null when header is missing", () => {
		const req = new Request("http://localhost");
		expect(getClientIp(req)).toBeNull();
	});
});

describe("checkRateLimit", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("allows first request", () => {
		const result = checkRateLimit("test:unique1", 3, 60_000);
		expect(result.allowed).toBe(true);
		expect(result.retryAfter).toBe(0);
	});

	it("allows up to max requests", () => {
		const key = "test:burst";
		expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
		expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
		expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
	});

	it("blocks after max requests", () => {
		const key = "test:blocked";
		checkRateLimit(key, 2, 60_000);
		checkRateLimit(key, 2, 60_000);
		const result = checkRateLimit(key, 2, 60_000);
		expect(result.allowed).toBe(false);
		expect(result.retryAfter).toBeGreaterThan(0);
	});

	it("resets after window expires", () => {
		const key = "test:expire";
		vi.useFakeTimers();

		checkRateLimit(key, 1, 1000);
		expect(checkRateLimit(key, 1, 1000).allowed).toBe(false);

		vi.advanceTimersByTime(1001);
		expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);

		vi.useRealTimers();
	});
});
