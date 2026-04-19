// src/routes/kirjaudu.tsx
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { LoginForm } from "~/components/auth/login-form";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/kirjaudu")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = useSearch({ from: "/kirjaudu" });
	const { t } = useTranslation("auth");

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">{t("login.tagline")}</p>
				</div>

				<LoginForm redirect={redirect} />

				<p className="text-center text-sm text-muted">
					{t("login.noAccount")}{" "}
					<Link
						data-testid="login-register-link"
						to="/rekisteroidy"
						className="text-accent hover:underline"
					>
						{t("login.registerLink")}
					</Link>
				</p>
			</div>
		</div>
	);
}
