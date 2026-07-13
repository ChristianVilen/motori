import { talliOrigin } from "@motori/server/origins";
import { createMiddleware } from "@tanstack/react-start";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const allowedOrigins: string[] = [
	...(process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean),
	// talli's cross-origin sign-out needs CORS (companion SSO app).
	talliOrigin(new URL(baseURL).hostname),
];

export const corsMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const origin = request.headers.get("origin");

		if (request.method === "OPTIONS" && origin) {
			if (!allowedOrigins.includes(origin)) {
				return new Response(null, { status: 403 });
			}
			const headers = new Headers();
			headers.set("Access-Control-Allow-Origin", origin);
			headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
			headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
			headers.set("Access-Control-Allow-Credentials", "true");
			headers.set("Access-Control-Max-Age", "86400");
			headers.set("Vary", "Origin");
			return new Response(null, { status: 204, headers });
		}

		const result = await next();

		if (origin && allowedOrigins.includes(origin)) {
			result.response.headers.set("Access-Control-Allow-Origin", origin);
			result.response.headers.set("Access-Control-Allow-Credentials", "true");
			result.response.headers.set("Vary", "Origin");
		}

		return result;
	},
);
