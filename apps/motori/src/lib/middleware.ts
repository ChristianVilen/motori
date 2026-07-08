import { csrfMiddleware } from "@motori/server/csrf";
import { rateLimitMiddleware } from "@motori/server/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";

/**
 * Standard middleware stack for user-facing mutations:
 * CSRF + rate limit + verified email.
 */
export function protectedMutation(prefix: string, max: number, windowSeconds: number) {
	return [
		csrfMiddleware(),
		rateLimitMiddleware(max, windowSeconds, prefix),
		requireVerifiedEmail(),
	];
}

/**
 * Middleware stack for mutations that only need CSRF protection
 * (admin routes, profile settings, onboarding).
 */
export function csrfOnly() {
	return [csrfMiddleware()];
}
