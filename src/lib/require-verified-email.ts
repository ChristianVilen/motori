import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { getSession } from "~/lib/session";

export function requireVerifiedEmail() {
	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const session = await getSession();
		if (!session) {
			setResponseStatus(401);
			throw new Error("UNAUTHORIZED");
		}

		if (session.user.emailVerified) {
			return next();
		}

		setResponseStatus(403);
		throw new Error("EMAIL_NOT_VERIFIED");
	});
}
