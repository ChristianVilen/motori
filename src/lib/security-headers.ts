import { createMiddleware } from "@tanstack/react-start";
import { log } from "~/lib/log";
import { getNonce } from "~/lib/nonce";

const storagePublicUrl = process.env.STORAGE_PUBLIC_URL ?? "";

const imgSrc = storagePublicUrl ? `'self' blob: data: ${storagePublicUrl}` : "'self' blob: data:";

function buildCsp(nonce: string | undefined): string {
	const scriptNonce = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";
	return [
		"default-src 'self'",
		`script-src 'self' ${scriptNonce}${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		`img-src ${imgSrc}`,
		"connect-src 'self'",
		"frame-ancestors 'none'",
	].join("; ");
}

export const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(
	async ({ next }) => {
		const result = await next();
		const nonce = getNonce();
		if (!nonce) {
			log.warn("CSP nonce missing — falling back to unsafe-inline");
		}
		const h = result.response.headers;
		h.set("X-Content-Type-Options", "nosniff");
		h.set("X-Frame-Options", "DENY");
		h.set("Referrer-Policy", "strict-origin-when-cross-origin");
		h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
		h.set("Content-Security-Policy", buildCsp(nonce));
		if (process.env.NODE_ENV === "production") {
			h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		}
		return result;
	},
);
