import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ilmoitukset/")({
	loader: () => {
		throw redirect({ to: "/pyorat/vuokraus", replace: true });
	},
	component: () => null,
});
