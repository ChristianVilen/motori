/// <reference types="vite/client" />

import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouter,
	useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { LoginModal } from "~/components/auth/login-modal";
import { BottomNav } from "~/components/nav/bottom-nav";
import { MobileSearchOverlay } from "~/components/nav/mobile-search-overlay";
import { SiteHeader } from "~/components/nav/site-header";
import { authClient, signOut, useSession } from "~/lib/auth-client";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { FavoritesProvider } from "~/lib/favorites-context";
import { i18n as clientI18n, ensureClientI18n } from "~/lib/i18n/client";
import { detectServerLocale } from "~/lib/i18n/detect-locale";
import type { SupportedLocale } from "~/lib/i18n/resources";
import { supportedLngs } from "~/lib/i18n/resources";
import { createI18nSync } from "~/lib/i18n/server";
import { LoginPromptProvider } from "~/lib/login-prompt-context";
import { getUnreadTotal } from "~/lib/messages";
import { getSession } from "~/lib/session";
import appCss from "~/styles/app.css?url";

import "@fontsource-variable/bricolage-grotesque/index.css";
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource/jetbrains-mono/index.css";

export const Route = createRootRoute({
	beforeLoad: async () => {
		let locale: SupportedLocale = "fi";
		// Read the request id from the server-only side channel (set in loggingMiddleware)
		// so the 500 page can render it; client-side navigations have no request to correlate.
		let requestId: string | undefined;
		if (typeof window === "undefined") {
			locale = await detectServerLocale();
			requestId = (
				globalThis as { __motoriGetRequestId?: () => string | undefined }
			).__motoriGetRequestId?.();
		}
		const session = await getSession();
		const unreadMessages = session ? (await getUnreadTotal()).unread : 0;
		return { locale, session, unreadMessages, requestId };
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },

			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: `${SITE_NAME} — Motoristien oma yhteisö` },
			{
				name: "description",
				content:
					"Osta, myy ja vuokraa moottoripyöriä, varusteita ja osia. Suomalainen motoristien yhteisö.",
			},
			{
				name: "theme-color",
				content: "#f7f6f2",
			},
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: SITE_NAME },
			{ property: "og:title", content: `${SITE_NAME} — Motoristien oma yhteisö` },
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
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/icon-192.png" },
			...supportedLngs.map((lng) => ({ rel: "alternate", hrefLang: lng, href: `${SITE_URL}/` })),
			{ rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/` },
		],
	}),
	component: RootComponent,
	errorComponent: RootError,
	notFoundComponent: NotFound,
});

function useRootI18n(locale: SupportedLocale = "fi") {
	const [instance] = useState(() => {
		if (typeof window === "undefined") {
			return createI18nSync(locale);
		}
		ensureClientI18n(locale);
		return clientI18n;
	});
	return instance;
}

function RootError({ error }: { error: unknown }) {
	// Set in beforeLoad and serialized into context, so it renders identically on
	// SSR and hydration. Surfaced so bug reports can be correlated to logs.
	const { requestId, locale = "fi" } = Route.useRouteContext();
	const instance = useRootI18n(locale);
	const t = instance.getFixedT(null, "common");
	return (
		<I18nextProvider i18n={instance}>
			<RootDocument locale={locale}>
				<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
					<h1 className="font-heading text-4xl font-bold text-foreground">
						{t("serverError.heading")}
					</h1>
					<p className="mt-4 max-w-md text-sm text-muted">{t("serverError.body")}</p>
					{requestId ? (
						<p className="mt-2 font-mono text-xs text-muted">
							{t("serverError.requestId", { id: requestId })}
						</p>
					) : null}
					{process.env.NODE_ENV !== "production" && (
						<pre className="mt-4 max-w-lg overflow-auto rounded bg-muted-light p-3 text-left text-xs">
							{error instanceof Error ? error.message : String(error)}
						</pre>
					)}
					<a
						href="/"
						className="mt-8 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
					>
						{t("notFound.back")}
					</a>
				</div>
			</RootDocument>
		</I18nextProvider>
	);
}

function NotFoundContent() {
	const { t } = useTranslation("common");
	return (
		<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
			<p className="font-heading text-7xl font-bold text-foreground">404</p>
			<h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
				{t("notFound.heading")}
			</h1>
			<p className="mt-2 max-w-md text-sm text-muted">{t("notFound.body")}</p>
			<Link
				to="/"
				className="mt-8 inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
			>
				{t("notFound.back")}
			</Link>
		</div>
	);
}

function NotFound() {
	// Renders INSIDE RootComponent's shell (the root component wraps notFoundComponent),
	// so no RootDocument here — nesting it duplicates <html>/<nav> on every 404. Keep a
	// local i18n instance so t() works even when the root loader never ran.
	const i18nInstance = useRootI18n();
	return (
		<I18nextProvider i18n={i18nInstance}>
			<NotFoundContent />
		</I18nextProvider>
	);
}

function RootComponent() {
	// Signals React hydration for e2e tests — event handlers are not attached during SSR,
	// and clicking before hydration causes native form submits instead of React's onSubmit.
	useEffect(() => {
		document.documentElement.setAttribute("data-hydrated", "true");
	}, []);

	const { locale, session, unreadMessages } = Route.useRouteContext();

	const i18nInstance = useRootI18n(locale);

	return (
		<I18nextProvider i18n={i18nInstance}>
			<RootDocument locale={locale} serverSession={session} unreadMessages={unreadMessages}>
				<Outlet />
			</RootDocument>
		</I18nextProvider>
	);
}

interface RootDocumentProps {
	children: ReactNode;
	locale?: SupportedLocale;
	serverSession?: Awaited<ReturnType<typeof getSession>>;
	unreadMessages?: number;
}
function RootDocument({
	children,
	locale = "fi",
	serverSession,
	unreadMessages = 0,
}: RootDocumentProps) {
	const router = useRouter();
	const [loginOpen, setLoginOpen] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const { t, i18n } = useTranslation("common");
	const currentLang = (i18n.language ?? locale) as SupportedLocale;
	const { data: clientSession } = useSession();
	const session = clientSession ?? serverSession;
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const isAdmin = pathname.startsWith("/admin");
	const isFullHeightRoute = pathname === "/viestit" || pathname.startsWith("/viestit/");
	const [resent, setResent] = useState(false);
	const [checkedSpam, setCheckedSpam] = useState(false);
	const verified = session?.user.emailVerified ?? false;

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
		<html lang={currentLang} dir="ltr" className="bg-background">
			<head>
				<meta name="csp-nonce" content={router.options.ssr?.nonce} />
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<FavoritesProvider loggedIn={!!session} onRequireLogin={() => setLoginOpen(true)}>
					<LoginPromptProvider loggedIn={!!session} onRequireLogin={() => setLoginOpen(true)}>
						<a
							href="#main-content"
							className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
						>
							{t("nav.skipToContent")}
						</a>
						{!isAdmin && (
							<SiteHeader
								loggedIn={!!session}
								verified={verified}
								unread={unreadMessages}
								onLogin={() => setLoginOpen(true)}
								onSignOut={handleSignOut}
								onSearch={() => setSearchOpen(true)}
							/>
						)}
						{!isAdmin && showVerifyBanner && (
							<VerifyBanner
								resent={resent}
								checkedSpam={checkedSpam}
								onCheckSpam={() => setCheckedSpam(true)}
								onResend={handleResendVerification}
							/>
						)}
						<main
							id="main-content"
							className={
								isAdmin
									? undefined
									: "pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] md:pb-0 print:pb-0"
							}
						>
							{children}
						</main>
						{!isAdmin && !isFullHeightRoute && (
							<footer className="border-t border-border px-4 pt-5 pb-[calc(1.25rem+var(--tabbar-height)+env(safe-area-inset-bottom))] text-center text-xs text-muted md:pb-5 print:hidden">
								<div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
									<Link
										to="/pyorat/myynti"
										data-testid="nav-pyorat-myynti"
										className="hover:text-foreground"
									>
										{t("footer.sale")}
									</Link>
									<Link
										to="/pyorat/vuokraus"
										data-testid="nav-pyorat-vuokraus"
										className="hover:text-foreground"
									>
										{t("footer.rental")}
									</Link>
									<Link
										to="/varusteet"
										data-testid="nav-varusteet"
										className="hover:text-foreground"
									>
										{t("footer.gear")}
									</Link>
									<Link to="/varaosat" data-testid="nav-varaosat" className="hover:text-foreground">
										{t("footer.parts")}
									</Link>
									<Link to="/kauppakirja" className="hover:text-foreground">
										{t("contract:footerLink")}
									</Link>
								</div>
								<span>{t("footer.copyright")}</span>
								<span className="mx-2">·</span>
								<Link to="/kayttoehdot" className="hover:text-foreground">
									{t("footer.terms")}
								</Link>
								<span className="mx-2">·</span>
								<Link to="/tietosuoja" className="hover:text-foreground">
									{t("footer.privacy")}
								</Link>
								<span className="ml-2 font-mono">{__APP_VERSION__}</span>
							</footer>
						)}
						{!isAdmin && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
						{!isAdmin && (
							<>
								<BottomNav
									session={session ?? null}
									verified={verified}
									unread={unreadMessages}
									onSignInClick={() => setLoginOpen(true)}
								/>
								{searchOpen ? <MobileSearchOverlay onClose={() => setSearchOpen(false)} /> : null}
							</>
						)}
						<Toaster position="top-right" richColors />
					</LoginPromptProvider>
				</FavoritesProvider>
				<Scripts />

				<script
					nonce={router.options.ssr?.nonce}
					suppressHydrationWarning
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline locale for hydration
					dangerouslySetInnerHTML={{
						__html: `window.__I18N__=${JSON.stringify({ locale }).replace(/</g, "\\u003c")};`,
					}}
				/>
			</body>
		</html>
	);
}

function VerifyBanner({
	resent,
	checkedSpam,
	onCheckSpam,
	onResend,
}: {
	resent: boolean;
	checkedSpam: boolean;
	onCheckSpam: () => void;
	onResend: () => void;
}) {
	const { t } = useTranslation("auth");
	return (
		<div className="bg-muted-light border-b border-border px-4 py-2 text-center text-sm">
			<span className="text-foreground">{t("verifyBanner.text")}</span>{" "}
			{resent ? (
				<span className="font-semibold text-foreground">{t("verifyBanner.sent")}</span>
			) : checkedSpam ? (
				<button
					type="button"
					onClick={onResend}
					className="font-semibold text-foreground hover:underline"
				>
					{t("verifyBanner.resend")}
				</button>
			) : (
				<button
					type="button"
					onClick={onCheckSpam}
					className="font-semibold text-foreground hover:underline"
				>
					{t("verifyBanner.checkSpam")}
				</button>
			)}
		</div>
	);
}
