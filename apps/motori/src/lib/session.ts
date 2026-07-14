import { createGetSession } from "@motori/server/session";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "~/lib/auth";
import { AppError } from "~/lib/errors";

// `auth` and createGetSession are referenced only inside the handler arrow so
// TanStack's compiler prunes them (and their node-only deps) from the client
// bundle. See the note in @motori/server/session.
export const getSession = createServerFn().handler(async () => createGetSession(auth)());

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Throws AppError("auth.unauthorized") when nobody is signed in. */
export async function requireSession(): Promise<Session> {
	const session = await getSession();
	if (!session) {
		throw new AppError("auth.unauthorized");
	}
	return session;
}

export async function requireUserId(): Promise<string> {
	return (await requireSession()).user.id;
}

/** Like requireSession, but for loaders: redirects to the sign-in page instead of throwing. */
export async function requireSessionOrRedirect(redirectTo?: string): Promise<Session> {
	const session = await getSession();
	if (!session) {
		throw redirect({ to: "/kirjaudu", search: { redirect: redirectTo } });
	}
	return session;
}
