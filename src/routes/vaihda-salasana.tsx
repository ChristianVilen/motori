import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";
import { useTranslation } from "~/lib/i18n";
import { passwordStrength } from "~/lib/password-strength";

export const Route = createFileRoute("/vaihda-salasana")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	head: () => ({
		meta: [{ title: "Vaihda salasana — Vuokramoto" }],
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { t } = useTranslation("auth");
	const { token, error: urlError } = useSearch({ from: "/vaihda-salasana" });
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const strength = passwordStrength(password);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		if (urlError === "INVALID_TOKEN") {
			setError(t("resetPassword.errorInvalidToken"));
		}
	}, [urlError, t]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (password !== confirm) {
			setError(t("resetPassword.errorMismatch"));
			return;
		}

		if (!token) {
			setError(t("resetPassword.errorInvalidToken"));
			return;
		}

		setLoading(true);
		try {
			const result = await authClient.resetPassword({ newPassword: password, token });
			if (result.error) {
				setError(t("resetPassword.errorGeneric"));
				return;
			}
			setSuccess(true);
		} catch {
			setError(t("resetPassword.errorGeneric"));
		} finally {
			setLoading(false);
		}
	}

	if (success) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-4">
				<div className="w-full max-w-sm space-y-6 text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="text-sm text-muted">{t("resetPassword.success")}</p>
					<Link
						to="/kirjaudu"
						search={{ redirect: undefined }}
						className="text-sm text-accent hover:underline"
					>
						{t("resetPassword.backToLogin")}
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">Vuokramoto</h1>
					<p className="mt-1 text-sm text-muted">{t("resetPassword.heading")}</p>
				</div>

				<form onSubmit={handleSubmit} data-testid="reset-password-form" className="space-y-4">
					<div className="space-y-2">
						<label htmlFor="password" className="text-sm font-medium text-foreground">
							{t("resetPassword.newPasswordLabel")}
						</label>
						<Input
							id="password"
							data-testid="reset-password-input"
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
								<p className="text-xs text-muted">{t(`register.${strength.labelKey}`)}</p>
							</div>
						)}
					</div>

					<div className="space-y-2">
						<label htmlFor="confirm" className="text-sm font-medium text-foreground">
							{t("resetPassword.confirmPasswordLabel")}
						</label>
						<Input
							id="confirm"
							data-testid="reset-password-confirm"
							type="password"
							autoComplete="new-password"
							required
							minLength={8}
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
						/>
					</div>

					{!!error && (
						<p data-testid="reset-password-error" className="text-sm text-destructive">
							{error}
						</p>
					)}

					<Button
						data-testid="reset-password-submit"
						type="submit"
						className="w-full bg-accent text-white hover:bg-accent-hover"
						disabled={loading || !token || strength.score <= 1}
					>
						{loading ? t("resetPassword.submitLoading") : t("resetPassword.submitIdle")}
					</Button>
				</form>
			</div>
		</div>
	);
}
