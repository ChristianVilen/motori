import { talliOrigin } from "@motori/server/origins";

// talli is the only trusted external redirect target (SSO companion app).
export function resolveExternalRedirect(
	redirect: string | undefined,
	hostname: string,
): string | null {
	if (!redirect) {
		return null;
	}
	const origin = talliOrigin(hostname);
	if (redirect === origin || redirect.startsWith(`${origin}/`)) {
		return redirect;
	}
	return null;
}
