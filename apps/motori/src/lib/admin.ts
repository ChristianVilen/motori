import { redirect } from "@tanstack/react-router";
import { getSession } from "~/lib/session";

export function isAdmin(user: { role?: string | null } | undefined) {
	return user?.role === "admin";
}
export async function requireAdmin() {
	const session = await getSession();
	if (!session || !isAdmin(session.user)) {
		throw redirect({ to: "/" });
	}
	return session;
}
