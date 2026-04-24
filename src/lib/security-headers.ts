import { createMiddleware } from "@tanstack/react-start";

const storagePublicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
const storageEndpoint = process.env.STORAGE_ENDPOINT ?? "";

const imgSrc = storagePublicUrl ? `'self' blob: data: ${storagePublicUrl}` : "'self' blob: data:";
const connectSrc = storageEndpoint ? `'self' ${storageEndpoint}` : "'self'";

const csp = [
	"default-src 'self'",
	// unsafe-inline required for TanStack Start SSR hydration inline scripts.
	// Nonce-based CSP is not yet supported by the framework (as of v0).
	// Risk: XSS payloads in inline scripts would execute. Mitigated by input
	// validation, CSP frame-ancestors 'none', and no user-controlled inline scripts.
	// unsafe-eval required in dev because Zod v4 uses new Function() at runtime.
	`script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com",
	`img-src ${imgSrc}`,
	`connect-src ${connectSrc}`,
	"frame-ancestors 'none'",
].join("; ");

export const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(
	async ({ next }) => {
		const result = await next();
		const h = result.response.headers;
		h.set("X-Content-Type-Options", "nosniff");
		h.set("X-Frame-Options", "DENY");
		h.set("Referrer-Policy", "strict-origin-when-cross-origin");
		h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
		h.set("Content-Security-Policy", csp);
		if (process.env.NODE_ENV === "production") {
			h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		}
		return result;
	},
);
