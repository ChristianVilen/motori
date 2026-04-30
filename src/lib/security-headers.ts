import { createMiddleware } from "@tanstack/react-start";
import { getNonce } from "~/lib/nonce";

const storagePublicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
const isProd = process.env.NODE_ENV === "production";

const imgSrc = storagePublicUrl ? `'self' blob: data: ${storagePublicUrl}` : "'self' blob: data:";

function buildCsp(nonce: string | undefined): string {
	// In dev, Vite injects HMR/refresh inline scripts without nonces, so we fall
	// back to 'unsafe-inline' + 'unsafe-eval' (Zod v4 uses new Function at runtime).
	// In prod, every inline <script> must carry the request nonce.
	const scriptSrc = isProd ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline' 'unsafe-eval'";
	return [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
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
		if (isProd && !nonce) {
			throw new Error(
				"CSP nonce missing — nonceMiddleware must run before securityHeadersMiddleware",
			);
		}
		const h = result.response.headers;
		h.set("X-Content-Type-Options", "nosniff");
		h.set("X-Frame-Options", "DENY");
		h.set("Referrer-Policy", "strict-origin-when-cross-origin");
		h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
		h.set("Content-Security-Policy", buildCsp(nonce));
		if (isProd) {
			h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		}
		return result;
	},
);
