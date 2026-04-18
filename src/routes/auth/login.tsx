// src/routes/auth/login.tsx
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { LoginForm } from "~/components/auth/login-form";

export const Route = createFileRoute("/auth/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = useSearch({ from: "/auth/login" });

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">Kirjaudu sisään</p>
				</div>

				<LoginForm redirect={redirect} />

				<p className="text-center text-sm text-muted">
					Ei tiliä?{" "}
					<Link
						data-testid="login-register-link"
						to="/auth/register"
						className="text-accent hover:underline"
					>
						Rekisteröidy
					</Link>
				</p>
			</div>
		</div>
	);
}
