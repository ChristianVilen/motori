import { createMiddleware } from "@tanstack/react-start";

const storagePublicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
const storageEndpoint = process.env.STORAGE_ENDPOINT ?? "";

const imgSrc = storagePublicUrl ? `'self' blob: data: ${storagePublicUrl}` : "'self' blob: data:";
const connectSrc = storageEndpoint ? `'self' ${storageEndpoint}` : "'self'";

const csp = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline'",
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
		return result;
	},
);
