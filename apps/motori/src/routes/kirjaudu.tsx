// src/routes/kirjaudu.tsx

import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { LoginForm } from "~/components/auth/login-form";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/kirjaudu")({
	head: () => ({
		meta: [{ title: `Kirjaudu sisään — ${SITE_NAME}` }],
	}),
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = useSearch({ from: "/kirjaudu" });
	const { t } = useTranslation("auth");

	return (
		<div className="mx-auto flex min-h-[65dvh] max-w-xl items-center justify-center px-4 py-10">
			<div className="w-full max-w-md space-y-6 rounded-sheet border border-border bg-card p-5 sm:p-8">
				<div className="text-center">
					<h1 className="font-heading text-2xl font-bold">{t("login.tagline")}</h1>
				</div>

				<LoginForm redirect={redirect} />

				<p className="text-center text-sm text-muted">
					{t("login.noAccount")}{" "}
					<Link
						data-testid="login-register-link"
						to="/rekisteroidy"
						className="text-foreground underline"
					>
						{t("login.registerLink")}
					</Link>
				</p>
			</div>
		</div>
	);
}
