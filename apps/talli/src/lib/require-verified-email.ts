import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { AppError } from "~/lib/errors";
import { getSession } from "~/lib/session";

export function requireVerifiedEmail() {
	return createMiddleware({ type: "function" }).server(async ({ next }) => {
		const session = await getSession();
		if (!session) {
			setResponseStatus(401);
			throw new AppError("Kirjaudu sisään");
		}

		if (session.user.emailVerified) {
			return next();
		}

		setResponseStatus(403);
		throw new AppError("Vahvista sähköpostiosoitteesi ensin");
	});
}
