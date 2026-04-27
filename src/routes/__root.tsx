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
import { I18nextProvider, useTranslation } from "react-i18next";
import { LoginModal } from "~/components/auth/login-modal";
import { authClient, signOut, useSession } from "~/lib/auth-client";
import { SITE_NAME } from "~/lib/constants";
import { i18n as clientI18n, ensureClientI18n } from "~/lib/i18n/client";
import type { SupportedLocale } from "~/lib/i18n/resources";
import { createI18nSync } from "~/lib/i18n/server";
import { useEmailVerified } from "~/lib/use-email-verified";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
	beforeLoad: () => {
		// Future: check location.pathname.startsWith("/en/") → "en"
		const locale: SupportedLocale = "fi";
		return { locale };
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },

			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: `${SITE_NAME} — Vuokraa moottoripyörä` },
			{
				name: "description",
				content:
					"Suomalainen moottoripyörien vuokrausilmoitukset. Vuokraa kaksipyöräinen tai ilmoita omasi vuokralle.",
			},
			{ name: "theme-color", content: "#1a1a2e" },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:title", content: `${SITE_NAME} — Vuokraa moottoripyörä` },
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
			{ rel: "alternate", hrefLang: "fi", href: "/" },
			{ rel: "alternate", hrefLang: "x-default", href: "/" },
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

function NotFoundContent() {
	const { t } = useTranslation("common");
	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
			<p className="font-heading text-7xl font-bold text-accent">404</p>
			<h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
				{t("notFound.heading")}
			</h1>
			<p className="mt-2 max-w-md text-sm text-muted">{t("notFound.body")}</p>
			<Link
				to="/"
				className="mt-8 rounded-lg bg-accent px-6 py-3 font-heading text-sm font-semibold text-white hover:bg-accent-hover"
			>
				{t("notFound.back")}
			</Link>
		</div>
	);
}

function NotFound() {
	// NotFound can render without a loader having run, so nav `t()` calls have no
	// provider otherwise. Mount a fresh Finnish i18n instance for the shell.
	const [i18nInstance] = useState(() => {
		if (typeof window === "undefined") {
			return createI18nSync("fi");
		}
		ensureClientI18n();
		return clientI18n;
	});
	return (
		<I18nextProvider i18n={i18nInstance}>
			<RootDocument locale="fi">
				<NotFoundContent />
			</RootDocument>
		</I18nextProvider>
	);
}

function RootComponent() {
	// Signals React hydration for e2e tests — event handlers are not attached during SSR,
	// and clicking before hydration causes native form submits instead of React's onSubmit.
	useEffect(() => {
		document.documentElement.setAttribute("data-hydrated", "true");
	}, []);

	const { locale } = Route.useRouteContext();

	const [i18nInstance] = useState(() => {
		if (typeof window === "undefined") {
			return createI18nSync(locale);
		}
		ensureClientI18n();
		return clientI18n;
	});

	return (
		<I18nextProvider i18n={i18nInstance}>
			<RootDocument locale={locale}>
				<Outlet />
			</RootDocument>
		</I18nextProvider>
	);
}

interface RootDocumentProps {
	children: ReactNode;
	locale?: SupportedLocale;
}
function RootDocument({ children, locale = "fi" }: RootDocumentProps) {
	const router = useRouter();
	const [loginOpen, setLoginOpen] = useState(false);
	const { t } = useTranslation("common");
	const { t: tAuth } = useTranslation("auth");
	const { data: session } = useSession();
	const isAdmin = router.state.location.pathname.startsWith("/admin");
	const [resent, setResent] = useState(false);
	const [checkedSpam, setCheckedSpam] = useState(false);
	const verified = useEmailVerified();

	const showVerifyBanner = session?.user && !session.user.emailVerified;

	async function handleResendVerification() {
		if (!session?.user?.email || resent) {
			return;
		}
		try {
			await authClient.sendVerificationEmail({
				email: session.user.email,
				callbackURL: "/",
			});
		} catch {
			// Silently fail — user can retry
		}
		setResent(true);
	}

	async function handleSignOut() {
		await signOut();
		router.invalidate();
		router.navigate({ to: "/" });
	}

	return (
		<html lang={locale} dir="ltr">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
				>
					Siirry sisältöön
				</a>
				{!isAdmin && (
					<nav className="border-b border-border bg-primary px-4 py-3">
						<div className="mx-auto flex max-w-6xl items-center justify-between">
							<Link to="/" className="font-heading text-lg font-bold text-white">
								{SITE_NAME}
							</Link>
							<div className="flex items-center gap-4 sm:gap-6">
								<Link to="/ilmoitukset" className="text-sm text-white/70 hover:text-white">
									{t("nav.browse")}
								</Link>
								{verified ? (
									<Link
										data-testid="nav-add-listing"
										to="/ilmoitukset/uusi"
										className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
									>
										{t("nav.listMotorcycle")}
									</Link>
								) : (
									<span
										data-testid="nav-add-listing"
										title={tAuth("unverifiedTooltip")}
										className="cursor-not-allowed rounded-md bg-white/20 px-3.5 py-1.5 text-sm font-medium text-white/70"
									>
										{t("nav.listMotorcycle")}
									</span>
								)}
								{session ? (
									<>
										<Link
											data-testid="nav-dashboard"
											to="/omat"
											className="text-sm text-white/70 hover:text-white"
										>
											{t("nav.myListings")}
										</Link>
										<button
											type="button"
											data-testid="nav-signout"
											onClick={handleSignOut}
											className="text-sm text-white/70 hover:text-white"
										>
											{t("nav.signOut")}
										</button>
									</>
								) : (
									<button
										type="button"
										data-testid="nav-login"
										onClick={() => setLoginOpen(true)}
										className="text-sm text-white/70 hover:text-white"
									>
										{t("nav.signIn")}
									</button>
								)}
							</div>
						</div>
					</nav>
				)}
				{!isAdmin && showVerifyBanner && (
					<div className="bg-warning/10 border-b border-warning/30 px-4 py-2 text-center text-sm">
						<span className="text-foreground">{tAuth("verifyBanner.text")}</span>{" "}
						{resent ? (
							<span className="font-medium text-accent">{tAuth("verifyBanner.sent")}</span>
						) : checkedSpam ? (
							<button
								type="button"
								onClick={handleResendVerification}
								className="font-medium text-accent hover:underline"
							>
								{tAuth("verifyBanner.resend")}
							</button>
						) : (
							<button
								type="button"
								onClick={() => setCheckedSpam(true)}
								className="font-medium text-accent hover:underline"
							>
								{tAuth("verifyBanner.checkSpam")}
							</button>
						)}
					</div>
				)}
				<main id="main-content">{children}</main>
				{!isAdmin && (
					<footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
						<span>© {new Date().getFullYear()} Christian Vilen</span>
						<span className="mx-2">·</span>
						<Link to="/kayttoehdot" className="hover:text-foreground">
							Käyttöehdot
						</Link>
						<span className="mx-2">·</span>
						<Link to="/tietosuoja" className="hover:text-foreground">
							Tietosuoja
						</Link>
					</footer>
				)}
				{!isAdmin && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
				<Scripts />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline locale for hydration
					dangerouslySetInnerHTML={{
						__html: `window.__I18N__=${JSON.stringify({ locale }).replace(/</g, "\\u003c")};`,
					}}
				/>
			</body>
		</html>
	);
}
