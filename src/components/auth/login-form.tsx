// src/components/auth/login-form.tsx
// Shared email/password login form — used by /auth/login page and the nav login modal.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { signIn } from "~/lib/auth-client";
import { useTranslation } from "~/lib/i18n";

interface LoginFormProps {
	onSuccess?: () => void;
	redirect?: string;
}

export function LoginForm({ onSuccess, redirect }: LoginFormProps) {
	const navigate = useNavigate();
	const { t } = useTranslation("auth");
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
			setError(t("login.errorInvalidCredentials"));
			return;
		}

		if (onSuccess) {
			onSuccess();
			return;
		}
		navigate({ to: redirect ?? "/" });
	}

	return (
		<form onSubmit={handleSubmit} data-testid="login-form" className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="login-email" className="text-sm font-medium text-foreground">
					{t("login.emailLabel")}
				</label>
				<Input
					id="login-email"
					data-testid="login-email"
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(e) => setEmail(e.target.value)}
				/>
			</div>

			<div className="space-y-2">
				<label htmlFor="login-password" className="text-sm font-medium text-foreground">
					{t("login.passwordLabel")}
				</label>
				<Input
					id="login-password"
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
				{loading ? t("login.submitLoading") : t("login.submitIdle")}
			</Button>
		</form>
	);
}
