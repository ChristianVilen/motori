/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Vuokramoto — Vuokraa moottoripyörä" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
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
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
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
						<div className="flex items-center gap-6">
							<Link to="/listings" className="text-sm text-white/70 hover:text-white">
								Selaa
							</Link>
							<Link
								to="/listings/new"
								className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
							>
								Ilmoita pyörä
							</Link>
						</div>
					</div>
				</nav>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
