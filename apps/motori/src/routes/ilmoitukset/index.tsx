import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ilmoitukset/")({
	loader: () => {
		throw redirect({ to: "/pyorat/myynti", replace: true });
	},
	component: () => null,
});
