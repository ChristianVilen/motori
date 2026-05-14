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
import { Toaster } from "sonner";
import { LoginModal } from "~/components/auth/login-modal";
import { UserMenu } from "~/components/auth/user-menu";
import { LanguageSelector } from "~/components/language-selector";
import { Logo } from "~/components/logo";
import { BottomNav } from "~/components/nav/bottom-nav";
import { CategoryDropdown } from "~/components/nav/category-dropdown";
import { MobileSearchOverlay } from "~/components/nav/mobile-search-overlay";
import { authClient, signOut, useSession } from "~/lib/auth-client";
import { SITE_NAME, SITE_URL } from "~/lib/constants";
import { i18n as clientI18n, ensureClientI18n } from "~/lib/i18n/client";
import { detectServerLocale } from "~/lib/i18n/detect-locale";
import type { SupportedLocale } from "~/lib/i18n/resources";
import { supportedLngs } from "~/lib/i18n/resources";
import { createI18nSync } from "~/lib/i18n/server";
import { getUnreadTotal } from "~/lib/messages";
import { getSession } from "~/lib/session";
import { useEmailVerified } from "~/lib/use-email-verified";
import appCss from "~/styles/app.css?url";

import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import "@fontsource/jetbrains-mono/index.css";

export const Route = createRootRoute({
	beforeLoad: async () => {
		let locale: SupportedLocale = "fi";
		if (typeof window === "undefined") {
			locale = await detectServerLocale();
		}
		const session = await getSession();
		const unreadMessages = session ? (await getUnreadTotal()).unread : 0;
		return { locale, session, unreadMessages };
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
				content: "#1a1a2e",
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
			{ rel: "apple-touch-icon", href: "/app-icon.svg" },
			...supportedLngs.map((lng) => ({ rel: "alternate", hrefLang: lng, href: `${SITE_URL}/` })),
			{ rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/` },
		],
	}),
	component: RootComponent,
	errorComponent: ({ error }) => {
		return (
			<RootDocument locale="fi">
				<div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
					<p className="font-heading text-5xl font-bold text-destructive">Virhe</p>
					<p className="mt-4 max-w-md text-sm text-muted">
						Jotain meni pieleen. Yritä ladata sivu uudelleen.
					</p>
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

	const { locale, session, unreadMessages } = Route.useRouteContext();

	const [i18nInstance] = useState(() => {
		if (typeof window === "undefined") {
			return createI18nSync(locale);
		}
		ensureClientI18n();
		return clientI18n;
	});

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
	const { t: tAuth } = useTranslation("auth");
	const { data: clientSession } = useSession();
	const session = clientSession ?? serverSession;
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
		<html lang={currentLang} dir="ltr" className="bg-background">
			<head>
				<meta name="csp-nonce" content={router.options.ssr?.nonce} />
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
				>
					{t("nav.skipToContent")}
				</a>
				{!isAdmin && (
					<nav className="bg-primary px-4 py-3">
						<div className="mx-auto flex max-w-6xl items-center justify-between">
							<Link to="/" className="flex items-center">
								<Logo variant="dark" className="h-8 w-auto" />
							</Link>
							<div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-x-6">
								<div className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex md:gap-x-6">
									<CategoryDropdown />
									<Link
										to="/varusteet"
										data-testid="nav-varusteet"
										className="text-sm text-white/70 hover:text-white"
									>
										{t("nav.gear")}
									</Link>
									<Link
										to="/varaosat"
										data-testid="nav-varaosat"
										className="text-sm text-white/70 hover:text-white"
									>
										{t("nav.parts")}
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
											<Link
												data-testid="nav-messages"
												to="/viestit"
												className="text-sm text-white/70 hover:text-white"
											>
												{t("nav.messages", "Viestit")}
												{unreadMessages > 0 && (
													<span className="ml-1 rounded-full bg-accent text-white text-xs px-2 py-0.5">
														{unreadMessages}
													</span>
												)}
											</Link>
											<UserMenu onSignOut={handleSignOut} />
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
								{!session && (
									<button
										type="button"
										data-testid="nav-login-mobile"
										onClick={() => setLoginOpen(true)}
										className="text-sm text-white/70 hover:text-white md:hidden"
									>
										{t("nav.signIn")}
									</button>
								)}
								<LanguageSelector />
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
				<main id="main-content" className="pb-16 md:pb-0">
					{children}
				</main>
				{!isAdmin && (
					<footer className="relative border-t border-border px-4 py-6 text-center text-xs text-muted">
						<div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
							<Link to="/pyorat/myynti" className="hover:text-foreground">
								{t("footer.sale")}
							</Link>
							<Link to="/pyorat/vuokraus" className="hover:text-foreground">
								{t("footer.rental")}
							</Link>
							<Link to="/varusteet" className="hover:text-foreground">
								{t("footer.gear")}
							</Link>
							<Link to="/varaosat" className="hover:text-foreground">
								{t("footer.parts")}
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
						<span className="absolute inset-y-0 right-4 hidden items-center font-mono sm:flex">
							{__APP_VERSION__}
						</span>
					</footer>
				)}
				{!isAdmin && <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />}
				{!isAdmin && (
					<>
						<BottomNav
							session={session ?? null}
							verified={verified ?? false}
							onSearchClick={() => setSearchOpen(true)}
							onSignInClick={() => setLoginOpen(true)}
						/>
						<MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
					</>
				)}
				<Toaster position="top-right" richColors />
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
