// Fixed-window rate limiter. A user can burst up to `max` requests at the
// boundary of two windows. Acceptable for MVP; switch to sliding window if needed.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";

interface Entry {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Entry>();

// Purge expired entries every 60s to prevent memory leak.
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of buckets) {
		if (entry.resetAt <= now) {
			buckets.delete(key);
		}
	}
}, 60_000).unref();

function check(
	key: string,
	max: number,
	windowMs: number,
): { allowed: boolean; retryAfter: number } {
	const now = Date.now();
	const entry = buckets.get(key);

	if (!entry || entry.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfter: 0 };
	}

	if (entry.count < max) {
		entry.count++;
		return { allowed: true, retryAfter: 0 };
	}

	return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

function getIp(request: Request): string | null {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}
	return null;
}

export function rateLimitMiddleware(max: number, windowSeconds: number, prefix: string) {
	const windowMs = windowSeconds * 1000;

	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const request = getRequest();
		const ip = getIp(request);

		// Skip rate limiting when IP is unavailable (e.g. dev without reverse proxy).
		if (!ip) {
			return next();
		}

		const key = `${prefix}:${ip}`;
		const { allowed, retryAfter } = check(key, max, windowMs);

		if (!allowed) {
			setResponseStatus(429);
			setResponseHeader("Retry-After", String(retryAfter));
			throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
		}

		return next();
	});
}
