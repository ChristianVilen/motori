import { redirect } from "@tanstack/react-router";
import { getSession } from "~/lib/session";

export async function requireAdmin() {
	const session = await getSession();
	if (session?.user.role !== "admin") {
		throw redirect({ to: "/" });
	}
	return session;
}
