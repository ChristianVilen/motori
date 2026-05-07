import { createMiddleware } from "@tanstack/react-start";

export function computeApexRedirect(
	request: Request,
	canonicalUrl: string | undefined,
): Response | null {
	if (!canonicalUrl) return null;
	let canonicalHost: string;
	try {
		canonicalHost = new URL(canonicalUrl).host;
	} catch {
		return null;
	}
	const url = new URL(request.url);
	if (url.host === canonicalHost) return null;

	const target = new URL(url.pathname + url.search, canonicalUrl);
	return new Response(null, {
		status: 301,
		headers: { location: target.toString() },
	});
}

export const apexRedirectMiddleware = createMiddleware({ type: "request" }).server(
	async ({ request, next }) => {
		const redirect = computeApexRedirect(request, process.env.BETTER_AUTH_URL);
		if (redirect) return redirect;
		return next();
	},
);
