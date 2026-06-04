import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { authClient, useSession } from "~/lib/auth-client";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

// Where to go after a successful sign-in. If the browser arrived here mid-OAuth
// (client_id present), bounce back to the authorize endpoint so the now-authenticated
// request issues the code. Otherwise go home.
function nextUrl(): string {
	if (typeof window === "undefined") {
		return "/";
	}
	const search = window.location.search;
	const params = new URLSearchParams(search);
	if (params.get("client_id")) {
		return `/api/auth/oauth2/authorize${search}`;
	}
	return "/";
}

function LoginPage() {
	const { data: session, isPending } = useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!isPending && session) {
			window.location.href = nextUrl();
		}
	}, [isPending, session]);

	if (isPending || session) return null;

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		const { error: signInError } = await authClient.signIn.email({ email, password });
		if (signInError) {
			setError("Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.");
			setSubmitting(false);
			return;
		}
		window.location.href = nextUrl();
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-white p-6"
			>
				<h1 className="font-heading text-xl font-bold text-foreground">Kirjaudu sisään</h1>
				<input
					type="email"
					required
					placeholder="Sähköposti"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="w-full rounded-lg border border-border px-3 py-2 text-sm"
				/>
				<input
					type="password"
					required
					placeholder="Salasana"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="w-full rounded-lg border border-border px-3 py-2 text-sm"
				/>
				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				<button
					type="submit"
					disabled={submitting}
					className="w-full rounded-lg bg-accent px-4 py-2 font-heading text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
				>
					{submitting ? "Kirjaudutaan…" : "Kirjaudu"}
				</button>
			</form>
		</div>
	);
}
