import { createGetSession } from "@motori/server/session";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "~/lib/auth";
import { TalliError } from "~/lib/errors";

// `auth` and createGetSession are referenced only inside the handler arrow so
// TanStack's compiler prunes them (and their node-only deps) from the client
// bundle. See the note in @motori/server/session.
export const getSession = createServerFn().handler(async () => createGetSession(auth)());

/** Assert an authenticated session and return its user id. */
export function requireUserId(session: Awaited<ReturnType<typeof getSession>>): string {
	if (!session) {
		throw new TalliError("Kirjaudu sisään");
	}
	return session.user.id;
}
