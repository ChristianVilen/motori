// src/routes/_protected.tsx
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "~/lib/session";

export const Route = createFileRoute("/_protected")({
	beforeLoad: async ({ location }) => {
		const session = await getSession();

		if (!session) {
			throw redirect({
				to: "/auth/login",
				search: { redirect: location.href },
			});
		}

		if (!session.user.emailVerified) {
			throw redirect({ to: "/auth/verify-email" });
		}

		return { session };
	},
	component: () => <Outlet />,
});
