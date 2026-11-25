import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { Logo } from "@motori/ui/logo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
		<div className="mx-auto flex min-h-[65dvh] max-w-xl items-center justify-center px-4 py-10">
			<div className="w-full max-w-md space-y-6 rounded-sheet border border-border bg-card p-5 sm:p-8">
				<div className="text-center">
					<Logo variant="light" className="mx-auto h-10" />
					<p className="mt-1 text-sm text-muted">{t("forgotPassword.heading")}</p>
				</div>

				{sent ? (
					<div className="space-y-4 text-center">
						<p className="text-sm text-muted">{t("forgotPassword.success")}</p>
						<Link
							to="/kirjaudu"
							search={{ redirect: undefined }}
							className="text-sm text-foreground underline"
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
								data-page-primary
								variant="reflector"
								className="w-full"
								disabled={loading}
							>
								{loading ? t("forgotPassword.submitLoading") : t("forgotPassword.submitIdle")}
							</Button>
						</form>
						<p className="text-center text-sm text-muted">
							<Link
								to="/kirjaudu"
								search={{ redirect: undefined }}
								className="text-foreground underline"
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
