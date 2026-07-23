// Single source of truth for talli's origin. Three security boundaries key on
// this — BetterAuth trustedOrigins/cookie scope, the CORS allowlist, and the
// open-redirect allowlist — so a divergence here is a silent SSO/CSRF bug.
// Deliberate two-app special case: motori + talli are the only apps. Parameterize
// only if a third consumer ever appears.

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** localhost or a raw IPv4 host = a dev machine (incl. phone-on-LAN testing), never prod. */
export function isDevHost(hostname: string): boolean {
	return hostname === "localhost" || IPV4.test(hostname);
}

export function talliOrigin(hostname: string): string {
	return isDevHost(hostname) ? `http://${hostname}:3001` : "https://talli.motori.fi";
}
