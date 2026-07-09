// Single source of truth for talli's origin. Three security boundaries key on
// this — BetterAuth trustedOrigins/cookie scope, the CORS allowlist, and the
// open-redirect allowlist — so a divergence here is a silent SSO/CSRF bug.
// Deliberate two-app special case: motori + talli are the only apps. Parameterize
// only if a third consumer ever appears.
export function talliOrigin(baseURL: string): string {
	return new URL(baseURL).hostname === "localhost"
		? "http://localhost:3001"
		: "https://talli.motori.fi";
}
