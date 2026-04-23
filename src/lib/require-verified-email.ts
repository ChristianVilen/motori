import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getSession } from "~/lib/session";

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export function requireVerifiedEmail() {
	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const session = await getSession();
		if (!session) {
			return next();
		}

		const { emailVerified, createdAt } = session.user;
		if (emailVerified) {
			return next();
		}

		const accountAge = Date.now() - new Date(createdAt).getTime();
		if (accountAge <= GRACE_PERIOD_MS) {
			return next();
		}

		setResponseStatus(403);
		throw new Error("EMAIL_NOT_VERIFIED");
	});
}
