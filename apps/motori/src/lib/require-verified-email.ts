import { createRequireVerifiedEmail } from "@motori/server/require-verified-email";
import { AppError } from "~/lib/errors";
import { getSession } from "~/lib/session";

export function requireVerifiedEmail() {
	return createRequireVerifiedEmail({
		getSession,
		unauthorized: () => new AppError("auth.unauthorized"),
		unverified: () => new AppError("auth.email_not_verified"),
	});
}
