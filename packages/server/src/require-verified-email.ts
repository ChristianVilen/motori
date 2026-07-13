import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

export interface RequireVerifiedEmailOpts {
	getSession: () => Promise<{ user: { emailVerified: boolean } } | null>;
	/** Error thrown (with 401) when there is no session. */
	unauthorized: () => Error;
	/** Error thrown (with 403) when the session's email is unverified. */
	unverified: () => Error;
}

/**
 * Function middleware that rejects unauthenticated (401) or unverified (403)
 * callers. Each app supplies its own `getSession` and error factory (motori uses
 * i18n codes, talli uses Finnish strings); the status-code/verification logic is
 * shared so it can't drift.
 */
export function createRequireVerifiedEmail(opts: RequireVerifiedEmailOpts) {
	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const session = await opts.getSession();
		if (!session) {
			setResponseStatus(401);
			throw opts.unauthorized();
		}
		if (session.user.emailVerified) {
			return next();
		}
		setResponseStatus(403);
		throw opts.unverified();
	});
}
