// talli is the only trusted external redirect target (SSO companion app).
// Mirrors the two-app special case in packages/server/src/auth.ts.
export function resolveExternalRedirect(
	redirect: string | undefined,
	hostname: string,
): string | null {
	if (!redirect) {
		return null;
	}
	const talliOrigin =
		hostname === "localhost" ? "http://localhost:3001" : "https://talli.motori.fi";
	if (redirect === talliOrigin || redirect.startsWith(`${talliOrigin}/`)) {
		return redirect;
	}
	return null;
}
