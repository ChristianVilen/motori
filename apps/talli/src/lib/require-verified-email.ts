import { createRequireVerifiedEmail } from "@motori/server/require-verified-email";
import { TalliError } from "~/lib/errors";
import { getSession } from "~/lib/session";

export function requireVerifiedEmail() {
	return createRequireVerifiedEmail({
		getSession,
		unauthorized: () => new TalliError("Kirjaudu sisään"),
		unverified: () => new TalliError("Vahvista sähköpostiosoitteesi ensin"),
	});
}
