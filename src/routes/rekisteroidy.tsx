// src/routes/rekisteroidy.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { signUp } from "~/lib/auth-client";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/rekisteroidy")({
	component: RegisterPage,
});

type StrengthKey = "strengthWeak" | "strengthFair" | "strengthStrong";

function passwordStrength(password: string): {
	score: number;
	labelKey: StrengthKey;
	color: string;
} {
	let score = 0;
	if (password.length >= 8) {
		score++;
	}
	if (password.length >= 12) {
		score++;
	}
	if (/[A-Z]/.test(password)) {
		score++;
	}
	if (/[0-9]/.test(password)) {
		score++;
	}
	if (/[^A-Za-z0-9]/.test(password)) {
		score++;
	}

	if (score <= 1) {
		return { score, labelKey: "strengthWeak", color: "bg-destructive" };
	}
	if (score <= 3) {
		return { score, labelKey: "strengthFair", color: "bg-warning" };
	}
	return { score, labelKey: "strengthStrong", color: "bg-success" };
}

function RegisterPage() {
	const navigate = useNavigate();
	const { t } = useTranslation("auth");
	const [name, setName] = useState("");
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
			name,
			email,
			password,
			callbackURL: "/taydenna-profiili",
		});

		setLoading(false);

		if (result.error) {
			if (result.error.code === "USER_ALREADY_EXISTS") {
				setError(t("register.errorAlreadyExists"));
			} else {
				setError(t("register.errorGeneric"));
			}
			return;
		}

		navigate({ to: "/vahvista-sahkoposti" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">{t("register.tagline")}</p>
				</div>

				<form onSubmit={handleSubmit} data-testid="register-form" className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium text-foreground">
							{t("register.nameLabel")}
						</label>
						<Input
							id="name"
							data-testid="register-name"
							type="text"
							autoComplete="name"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium text-foreground">
							{t("register.emailLabel")}
						</label>
						<Input
							id="email"
							data-testid="register-email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium text-foreground">
							{t("register.passwordLabel")}
						</label>
						<Input
							id="password"
							data-testid="register-password"
							type="password"
							autoComplete="new-password"
							required
							minLength={8}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						{password.length > 0 && (
							<div
								data-testid="password-strength"
								data-strength={t(`register.${strength.labelKey}`)}
								className="space-y-1"
							>
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
								<p data-testid="password-strength-label" className="text-xs text-muted">
									{t(`register.${strength.labelKey}`)}
								</p>
							</div>
						)}
					</div>

					{!!error && (
						<p data-testid="register-error" className="text-sm text-destructive">
							{error}
						</p>
					)}

					<Button
						data-testid="register-submit"
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading}
					>
						{loading ? t("register.submitLoading") : t("register.submitIdle")}
					</Button>
				</form>

				<p className="text-center text-sm text-muted">
					{t("register.hasAccount")}{" "}
					<Link
						data-testid="register-login-link"
						to="/kirjaudu"
						search={{ redirect: undefined }}
						className="text-accent hover:underline"
					>
						{t("register.loginLink")}
					</Link>
				</p>

				<p className="text-center text-xs text-muted">{t("register.termsNotice")}</p>
			</div>
		</div>
	);
}
