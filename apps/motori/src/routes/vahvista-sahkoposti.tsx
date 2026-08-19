// src/routes/vahvista-sahkoposti.tsx
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { authClient } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/vahvista-sahkoposti")({
	head: () => ({
		meta: [{ title: `Vahvista sähköposti — ${SITE_NAME}` }],
	}),
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { t } = useTranslation("auth");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		try {
			await authClient.sendVerificationEmail({ email, callbackURL: "/" });
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
			<div className="w-full max-w-sm space-y-6 text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted-light">
					<Mail className="h-8 w-8 text-accent" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold text-primary">{t("verifyEmail.heading")}</h1>
					<p className="text-sm text-muted">{t("verifyEmail.body")}</p>
				</div>

				{sent ? (
					<p className="text-sm text-muted">{t("verifyEmail.resendSuccess")}</p>
				) : (
					<form
						onSubmit={handleSubmit}
						data-testid="resend-verification-form"
						className="space-y-4 text-left"
					>
						<div className="space-y-2">
							<label htmlFor="resend-email" className="text-sm font-medium text-foreground">
								{t("verifyEmail.resendLabel")}
							</label>
							<Input
								id="resend-email"
								data-testid="resend-verification-email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<Button
							data-testid="resend-verification-submit"
							type="submit"
							className="w-full bg-accent text-white hover:bg-accent-hover"
							disabled={loading}
						>
							{loading ? t("verifyEmail.resendLoading") : t("verifyEmail.resendSubmit")}
						</Button>
					</form>
				)}

				<p className="text-sm text-muted">
					<Link to="/kirjaudu" search={{ redirect: undefined }} className="text-accent underline">
						{t("verifyEmail.backToLogin")}
					</Link>
				</p>
			</div>
		</div>
	);
}
