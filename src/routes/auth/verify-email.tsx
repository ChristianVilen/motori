// src/routes/auth/verify-email.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/auth/verify-email")({
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<div className="w-full max-w-sm space-y-6 text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted-light">
					<Mail className="h-8 w-8 text-accent" />
				</div>

				<div className="space-y-2">
					<h1 className="text-2xl font-bold text-primary">Tarkista sähköpostisi</h1>
					<p className="text-sm text-muted">
						Lähetimme vahvistuslinkin sähköpostiisi. Klikkaa linkkiä jatkaaksesi.
					</p>
				</div>

				<p className="text-xs text-muted">
					Eikö viesti tullut?{" "}
					<Link to="/auth/login" className="text-accent hover:underline">
						Kirjaudu uudelleen
					</Link>{" "}
					lähettääksesi uuden.
				</p>
			</div>
		</div>
	);
}
