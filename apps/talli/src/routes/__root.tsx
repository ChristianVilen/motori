/// <reference types="vite/client" />

import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { Toaster } from "sonner";
import { MOTORI_URL, SITE_NAME } from "~/lib/constants";
import appCss from "~/styles/app.css?url";

import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";

export const Route = createRootRoute({
	beforeLoad: async () => {
		let requestId: string | undefined;
		if (typeof window === "undefined") {
			requestId = (
				globalThis as { __motoriGetRequestId?: () => string | undefined }
			).__motoriGetRequestId?.();
		}
		return { requestId };
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: `${SITE_NAME} — Pidä pyöräsi kunnossa` },
			{
				name: "description",
				content: "Huoltokirja, muistutukset ja mittarilukemat moottoripyörällesi.",
			},
			{ name: "theme-color", content: "#1a1a2e" },
			{ name: "robots", content: "noindex" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	component: RootComponent,
	errorComponent: ({ error }) => {
		const { requestId } = Route.useRouteContext();
		return (
			<RootDocument>
				<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
					<p className="font-heading text-5xl font-bold text-destructive">Virhe</p>
					<p className="mt-4 max-w-md text-sm text-muted">
						Jotain meni pieleen. Yritä ladata sivu uudelleen.
					</p>
					{requestId ? (
						<p className="mt-2 font-mono text-xs text-muted">Pyynnön tunniste: {requestId}</p>
					) : null}
					{process.env.NODE_ENV !== "production" && (
						<pre className="mt-4 max-w-lg overflow-auto rounded bg-muted-light p-3 text-left text-xs">
							{error.message}
						</pre>
					)}
					<a
						href="/"
						className="mt-8 rounded-lg bg-accent px-6 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
					>
						Etusivulle
					</a>
				</div>
			</RootDocument>
		);
	},
	notFoundComponent: () => (
		<RootDocument>
			<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
				<p className="font-heading text-7xl font-bold text-accent">404</p>
				<h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Sivua ei löytynyt</h1>
				<Link
					to="/"
					className="mt-8 rounded-lg bg-accent px-6 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
				>
					Etusivulle
				</Link>
			</div>
		</RootDocument>
	),
});

function RootComponent() {
	// Signals React hydration for e2e tests — same contract as motori.
	useEffect(() => {
		document.documentElement.setAttribute("data-hydrated", "true");
	}, []);

	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	const router = useRouter();
	return (
		<html lang="fi" dir="ltr" className="bg-background">
			<head>
				<meta name="csp-nonce" content={router.options.ssr?.nonce} />
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<nav className="bg-primary px-4 py-3">
					<div className="mx-auto flex max-w-4xl items-center justify-between">
						<Link to="/" className="font-heading text-lg font-bold text-white">
							Talli
						</Link>
						<div className="flex items-center gap-4">
							<a
								href={MOTORI_URL}
								data-testid="nav-motori"
								className="text-sm text-white/70 hover:text-white"
							>
								Motori.fi
							</a>
						</div>
					</div>
				</nav>
				<main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
				<footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
					<span>Talli on osa Motoria</span>
					<span className="mx-2">·</span>
					<a href={MOTORI_URL} className="hover:text-foreground">
						motori.fi
					</a>
				</footer>
				<Toaster position="top-right" richColors />
				<Scripts />
			</body>
		</html>
	);
}
