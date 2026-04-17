/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
});

function RootComponent() {
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
