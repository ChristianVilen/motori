import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { authClient } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/unohdin-salasanan")({
	head: () => ({
		meta: [{ title: `Unohdin salasanan — ${SITE_NAME}` }],
	}),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { t } = useTranslation("auth");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		try {
			await authClient.requestPasswordReset({
				email,
				redirectTo: "/vaihda-salasana",
			});
			setSent(true);
		} catch {
			// Always show success to avoid leaking whether the email exists
			setSent(true);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-primary">{SITE_NAME}</h1>
					<p className="mt-1 text-sm text-muted">{t("forgotPassword.heading")}</p>
				</div>

				{sent ? (
					<div className="space-y-4 text-center">
						<p className="text-sm text-muted">{t("forgotPassword.success")}</p>
						<Link
							to="/kirjaudu"
							search={{ redirect: undefined }}
							className="text-sm text-accent underline"
						>
							{t("forgotPassword.backToLogin")}
						</Link>
					</div>
				) : (
					<>
						<p className="text-sm text-muted">{t("forgotPassword.body")}</p>
						<form onSubmit={handleSubmit} data-testid="forgot-password-form" className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="email" className="text-sm font-medium text-foreground">
									{t("forgotPassword.emailLabel")}
								</label>
								<Input
									id="email"
									data-testid="forgot-password-email"
									type="email"
									autoComplete="email"
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<Button
								data-testid="forgot-password-submit"
								type="submit"
								className="w-full bg-accent text-white hover:bg-accent-hover"
								disabled={loading}
							>
								{loading ? t("forgotPassword.submitLoading") : t("forgotPassword.submitIdle")}
							</Button>
						</form>
						<p className="text-center text-sm text-muted">
							<Link
								to="/kirjaudu"
								search={{ redirect: undefined }}
								className="text-accent underline"
							>
								{t("forgotPassword.backToLogin")}
							</Link>
						</p>
					</>
				)}
			</div>
		</div>
	);
}
