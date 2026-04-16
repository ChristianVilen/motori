// src/routes/auth/register.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { signUp } from "~/lib/auth-client";

export const Route = createFileRoute("/auth/register")({
	component: RegisterPage,
});

function passwordStrength(password: string): { score: number; label: string; color: string } {
	let score = 0;
	if (password.length >= 8) score++;
	if (password.length >= 12) score++;
	if (/[A-Z]/.test(password)) score++;
	if (/[0-9]/.test(password)) score++;
	if (/[^A-Za-z0-9]/.test(password)) score++;

	if (score <= 1) return { score, label: "Heikko", color: "bg-destructive" };
	if (score <= 3) return { score, label: "Kohtalainen", color: "bg-warning" };
	return { score, label: "Vahva", color: "bg-success" };
}

function RegisterPage() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const strength = passwordStrength(password);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const result = await signUp.email({
			email,
			password,
			name: email.split("@")[0],
			callbackURL: "/auth/complete-profile",
		});

		setLoading(false);

		if (result.error) {
			if (result.error.code === "USER_ALREADY_EXISTS") {
				setError("Tällä sähköpostilla on jo tili.");
			} else {
				setError("Rekisteröityminen epäonnistui. Yritä uudelleen.");
			}
			return;
		}

		navigate({ to: "/auth/verify-email" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">Luo tili</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium text-foreground">
							Sähköposti
						</label>
						<Input
							id="email"
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
							type="password"
							autoComplete="new-password"
							required
							minLength={8}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						{password.length > 0 && (
							<div className="space-y-1">
								<div className="flex gap-1">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className={`h-1 flex-1 rounded-full transition-colors ${
												i <= strength.score ? strength.color : "bg-border"
											}`}
										/>
									))}
								</div>
								<p className="text-xs text-muted">{strength.label}</p>
							</div>
						)}
					</div>

					{error && (
						<p className="text-sm text-destructive">{error}</p>
					)}

					<Button
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading}
					>
						{loading ? "Luodaan tiliä..." : "Luo tili"}
					</Button>
				</form>

				<p className="text-center text-sm text-muted">
					Onko sinulla jo tili?{" "}
					<Link to="/auth/login" search={{ redirect: undefined }} className="text-accent hover:underline">
						Kirjaudu sisään
					</Link>
				</p>

				<p className="text-center text-xs text-muted">
					Rekisteröitymällä hyväksyt käyttöehdot
				</p>
			</div>
		</div>
	);
}
