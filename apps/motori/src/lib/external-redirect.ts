import { talliOrigin } from "@motori/server/origins";

// talli is the only trusted external redirect target (SSO companion app).
export function resolveExternalRedirect(
	redirect: string | undefined,
	hostname: string,
): string | null {
	if (!redirect) {
		return null;
	}
	// The caller passes a bare browser hostname; talliOrigin keys off it.
	const origin = talliOrigin(`https://${hostname}`);
	if (redirect === origin || redirect.startsWith(`${origin}/`)) {
		return redirect;
	}
	return null;
}
