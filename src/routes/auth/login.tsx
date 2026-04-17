// src/routes/auth/login.tsx
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { signIn } from "~/lib/auth-client";

export const Route = createFileRoute("/auth/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const { redirect } = useSearch({ from: "/auth/login" });
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const result = await signIn.email({ email, password });

		setLoading(false);

		if (result.error) {
			if (result.error.code === "EMAIL_NOT_VERIFIED") {
				navigate({ to: "/auth/verify-email" });
				return;
			}
			setError("Väärä sähköposti tai salasana.");
			return;
		}

		navigate({ to: redirect ?? "/" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">Kirjaudu sisään</p>
				</div>

				<form onSubmit={handleSubmit} data-testid="login-form" className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium text-foreground">
							Sähköposti
						</label>
						<Input
							id="email"
							data-testid="login-email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium text-foreground">
							Salasana
						</label>
						<Input
							id="password"
							data-testid="login-password"
							type="password"
							autoComplete="current-password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>

					{!!error && (
						<p data-testid="login-error" className="text-sm text-destructive">
							{error}
						</p>
					)}

					<Button
						data-testid="login-submit"
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading}
					>
						{loading ? "Kirjaudutaan..." : "Kirjaudu"}
					</Button>
				</form>

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
