/// <reference types="vite/client" />

import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { LoginModal } from "~/components/auth/login-modal";
import { signOut } from "~/lib/auth-client";
import { getSession } from "~/lib/session";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
	loader: async () => {
		const session = await getSession();
		return { session };
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Vuokramoto — Vuokraa moottoripyörä" },
			{
				name: "description",
				content:
					"Suomalainen moottoripyörien vuokrausilmoitukset. Vuokraa kaksipyöräinen tai ilmoita omasi vuokralle.",
			},
			{ name: "theme-color", content: "#1a1a2e" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "Vuokramoto" },
			{ property: "og:title", content: "Vuokramoto — Vuokraa moottoripyörä" },
			{
				property: "og:description",
				content: "Suomalainen moottoripyörien vuokrausilmoitukset.",
			},
			{ property: "og:locale", content: "fi_FI" },
			{ name: "twitter:card", content: "summary_large_image" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.webmanifest" },
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "apple-touch-icon", href: "/icon-192.png" },
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap",
			},
		],
	}),
	component: RootComponent,
	notFoundComponent: NotFound,
});

function NotFound() {
	return (
		<RootDocument>
			<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
				<p className="font-heading text-7xl font-bold text-accent">404</p>
				<h1 className="mt-4 font-heading text-2xl font-bold text-foreground">Sivua ei löytynyt</h1>
				<p className="mt-2 max-w-md text-sm text-muted">
					Etsimääsi sivua ei ole olemassa tai se on poistettu.
				</p>
				<Link
					to="/"
					className="mt-8 rounded-lg bg-accent px-6 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
				>
					Takaisin etusivulle
				</Link>
			</div>
		</RootDocument>
	);
}

function RootComponent() {
	// Signals React hydration for e2e tests — event handlers are not attached during SSR,
	// and clicking before hydration causes native form submits instead of React's onSubmit.
	useEffect(() => {
		document.documentElement.setAttribute("data-hydrated", "true");
	}, []);
	const { session } = Route.useLoaderData();
	return (
		<RootDocument session={session}>
			<Outlet />
		</RootDocument>
	);
}

interface RootDocumentProps {
	children: ReactNode;
	session?: Awaited<ReturnType<typeof getSession>>;
}

function RootDocument({ children, session }: RootDocumentProps) {
	const router = useRouter();
	const [loginOpen, setLoginOpen] = useState(false);

	async function handleSignOut() {
		await signOut();
		router.invalidate();
		router.navigate({ to: "/" });
	}

	return (
		<html lang="fi">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<nav className="border-b border-border bg-primary px-4 py-3">
					<div className="mx-auto flex max-w-6xl items-center justify-between">
						<Link to="/" className="font-heading text-lg font-bold text-white">
							vuokramoto
						</Link>
						<div className="flex items-center gap-4 sm:gap-6">
							<Link to="/listings" className="text-sm text-white/70 hover:text-white">
								Selaa
							</Link>
							<Link
								to="/listings/new"
								className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
							>
								Ilmoita pyörä
							</Link>
							{session ? (
								<>
									<Link
										data-testid="nav-dashboard"
										to="/dashboard"
										className="text-sm text-white/70 hover:text-white"
									>
										Omat
									</Link>
									<button
										type="button"
										data-testid="nav-signout"
										onClick={handleSignOut}
										className="text-sm text-white/70 hover:text-white"
									>
										Kirjaudu ulos
									</button>
								</>
							) : (
								<button
									type="button"
									data-testid="nav-login"
									onClick={() => setLoginOpen(true)}
									className="text-sm text-white/70 hover:text-white"
								>
									Kirjaudu
								</button>
							)}
						</div>
					</div>
				</nav>
				{children}
				<LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
				<Scripts />
			</body>
		</html>
	);
}
