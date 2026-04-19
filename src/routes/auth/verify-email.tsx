// src/routes/auth/verify-email.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useTranslation } from "~/lib/i18n";

export const Route = createFileRoute("/auth/verify-email")({
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const { t } = useTranslation("auth");

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

				<p className="text-xs text-muted">{t("verifyEmail.noEmail")}</p>
			</div>
		</div>
	);
}
