// src/routes/rekisteroidy.tsx

import { passwordStrength } from "@motori/server/password-strength";
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "~/components/logo";
import { signUp } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/rekisteroidy")({
	head: () => ({
		meta: [{ title: `Rekisteröidy — ${SITE_NAME}` }],
	}),
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const { t } = useTranslation("auth");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [termsAccepted, setTermsAccepted] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const strength = passwordStrength(password);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
		const result = await signUp.email({
			name: fullName,
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

		navigate({ to: "/taydenna-profiili" });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<Logo variant="light" className="mx-auto h-10 w-auto" />
					<p className="mt-1 text-sm text-muted">{t("register.tagline")}</p>
				</div>

				<form onSubmit={handleSubmit} data-testid="register-form" className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<label htmlFor="firstName" className="text-sm font-medium text-foreground">
								{t("register.firstNameLabel")}
							</label>
							<Input
								id="firstName"
								data-testid="register-first-name"
								type="text"
								autoComplete="given-name"
								required
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="lastName" className="text-sm font-medium text-foreground">
								{t("register.lastNameLabel")}
							</label>
							<Input
								id="lastName"
								data-testid="register-last-name"
								type="text"
								autoComplete="family-name"
								required
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
							/>
						</div>
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
						<p data-testid="register-error" role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}

					<label className="flex items-start gap-2 text-sm text-foreground/80">
						<input
							data-testid="register-terms"
							type="checkbox"
							required
							checked={termsAccepted}
							onChange={(e) => setTermsAccepted(e.target.checked)}
							className="mt-0.5 h-4 w-4 shrink-0"
						/>
						<span>
							{t("register.termsCheckboxPrefix")}{" "}
							<Link to="/kayttoehdot" className="text-accent underline" target="_blank">
								{t("register.termsLink")}
							</Link>{" "}
							{t("register.termsCheckboxAnd")}{" "}
							<Link to="/tietosuoja" className="text-accent underline" target="_blank">
								{t("register.privacyLink")}
							</Link>
						</span>
					</label>

					<Button
						data-testid="register-submit"
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading || !termsAccepted}
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
						className="text-accent underline"
					>
						{t("register.loginLink")}
					</Link>
				</p>
			</div>
		</div>
	);
}
