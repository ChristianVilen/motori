# Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a type-safe, SSR-correct i18n layer (Finnish today, English-ready) and rename routes to Finnish path segments for SEO.

**Architecture:** `react-i18next` + `i18next` with module augmentation for typed keys. Per-request i18n instance on the server; singleton on the client hydrated from `window.__I18N__`. Locale detected from URL path (`/` = `fi`, future `/en/...` = `en`) in `__root.tsx` `beforeLoad` and exposed on router context. SEO (`<html lang>`, `hreflang`, `og:locale`) emitted from `__root.tsx` head on every request.

**Tech Stack:** TanStack Start (SSR + file-based routing), React 19, `i18next` ^25, `react-i18next` ^16, TypeScript strict, Biome (tabs, 100-col).

**Spec:** `docs/superpowers/specs/2026-04-18-localization-design.md`.

**Reconciliation with current repo state (post-spec):**
- Spec's `routes/profile/index.tsx` → `routes/profiili/index.tsx` is obsolete. Current repo has:
	- `routes/dashboard/index.tsx` (owner's own listings) → rename to `routes/omat/index.tsx`
	- `routes/profile/$userId.tsx` (public profile) → rename to `routes/profiili/$userId.tsx`
	- `routes/profile/settings.tsx` → rename to `routes/profiili/asetukset.tsx`
- Everything else in the spec's rename table stands.

---

## File Structure

**Created:**
- `src/lib/i18n/index.ts` — public barrel: re-exports `useT`, `Trans`, helpers
- `src/lib/i18n/server.ts` — `createI18n(locale)` per-request factory
- `src/lib/i18n/client.ts` — browser singleton, hydrates from `window.__I18N__`
- `src/lib/i18n/format.ts` — `formatEur`, `formatDate`
- `src/lib/i18n/react-i18next.d.ts` — module augmentation for typed keys
- `src/lib/i18n/resources/index.ts` — aggregates per-locale bundles `as const`
- `src/lib/i18n/resources/fi/common.ts`
- `src/lib/i18n/resources/fi/home.ts`
- `src/lib/i18n/resources/fi/listings.ts`
- `src/lib/i18n/resources/fi/auth.ts`
- `src/lib/i18n/resources/fi/profile.ts`
- `src/lib/i18n/format.test.ts` — unit tests for formatters

**Modified (routing & SEO wiring):**
- `src/routes/__root.tsx` — locale detection in `beforeLoad`, `<I18nextProvider>`, dynamic `<html lang>`, `hreflang`, `og:locale`, replace hardcoded strings

**Modified (strings only — see namespace extraction tasks):**
- Every file under `src/routes/` (except `api/`) and `src/components/`

**Renamed (route tree — Finnish segments):**
- `routes/listings/` → `routes/ilmoitukset/`
	- `index.tsx` → `ilmoitukset/index.tsx`
	- `new.tsx` → `ilmoitukset/uusi.tsx`
	- `$listingId.tsx` → `ilmoitukset/$listingId.tsx`
	- `$listingId_.edit.tsx` → `ilmoitukset/$listingId_.muokkaa.tsx`
- `routes/auth/login.tsx` → `routes/kirjaudu.tsx`
- `routes/auth/register.tsx` → `routes/rekisteroidy.tsx`
- `routes/auth/verify-email.tsx` → `routes/vahvista-sahkoposti.tsx`
- `routes/auth/complete-profile.tsx` → `routes/taydenna-profiili.tsx`
- `routes/dashboard/index.tsx` → `routes/omat/index.tsx`
- `routes/profile/$userId.tsx` → `routes/profiili/$userId.tsx`
- `routes/profile/settings.tsx` → `routes/profiili/asetukset.tsx`
- `routes/api/**` — **unchanged**

**E2E tests updated:**
- `e2e/global-setup.ts`, `e2e/pages/*.ts`, `e2e/tests/*.spec.ts` — all hardcoded URLs rewritten to Finnish paths. Visible Finnish text assertions unchanged.

---

## Conventions for every task

- TDD where tests fit (format helpers, locale detection helper). For pure string-extraction refactors, "test" = `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green at the end of the task.
- After every task: `pnpm typecheck && pnpm lint`. Commit when green.
- Biome: tabs, 100-col, no `console.*`, no `any`.
- Never edit `src/routeTree.gen.ts` — it regenerates. If stale, delete and restart `pnpm dev` once.
- Commit messages: `feat(i18n): ...`, `refactor(i18n): ...`, `chore(i18n): rename routes to Finnish`, etc. No `Co-Authored-By` lines.

---

## Task 1: Install dependencies and scaffold module

**Files:**
- Modify: `package.json` (via pnpm add)
- Create: `src/lib/i18n/index.ts`
- Create: `src/lib/i18n/resources/fi/common.ts`
- Create: `src/lib/i18n/resources/index.ts`
- Create: `src/lib/i18n/react-i18next.d.ts`

- [ ] **Step 1.1: Install deps**

```bash
pnpm add i18next@^25 react-i18next@^16
```

- [ ] **Step 1.2: Create `resources/fi/common.ts` with minimal keys**

```ts
// src/lib/i18n/resources/fi/common.ts
export default {
	nav: {
		browse: "Selaa",
		listMotorcycle: "Ilmoita pyörä",
		myListings: "Omat",
		signIn: "Kirjaudu",
		signOut: "Kirjaudu ulos",
	},
	notFound: {
		heading: "Sivua ei löytynyt",
		body: "Etsimääsi sivua ei ole olemassa tai se on poistettu.",
		back: "Takaisin etusivulle",
	},
	actions: {
		save: "Tallenna",
		cancel: "Peruuta",
		delete: "Poista",
		edit: "Muokkaa",
	},
	errors: {
		generic: "Jotain meni pieleen. Yritä uudelleen.",
	},
} as const;
```

- [ ] **Step 1.3: Create empty namespace stubs**

Create `home.ts`, `listings.ts`, `auth.ts`, `profile.ts` in `src/lib/i18n/resources/fi/` each with `export default {} as const;`. Later tasks populate them.

- [ ] **Step 1.4: Create `resources/index.ts` aggregator**

```ts
// src/lib/i18n/resources/index.ts
import auth from "./fi/auth";
import common from "./fi/common";
import home from "./fi/home";
import listings from "./fi/listings";
import profile from "./fi/profile";

export const resources = {
	fi: { common, home, listings, auth, profile },
} as const;

export const defaultNS = "common" as const;
export const supportedLngs = ["fi"] as const;
export type SupportedLocale = (typeof supportedLngs)[number];
```

- [ ] **Step 1.5: Create module augmentation**

```ts
// src/lib/i18n/react-i18next.d.ts
import type { resources, defaultNS } from "./resources";

declare module "react-i18next" {
	interface CustomTypeOptions {
		defaultNS: typeof defaultNS;
		resources: (typeof resources)["fi"];
	}
}
```

- [ ] **Step 1.6: Create `index.ts` barrel**

```ts
// src/lib/i18n/index.ts
export { Trans, useTranslation } from "react-i18next";
export { formatDate, formatEur } from "./format";
export type { SupportedLocale } from "./resources";
export { defaultNS, resources, supportedLngs } from "./resources";
```

(`format` file created in Task 2 — if `pnpm typecheck` runs before Task 2 completes, this import will error. Defer verification to end of Task 2.)

- [ ] **Step 1.7: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/i18n/
git commit -m "feat(i18n): scaffold i18next module and Finnish resource bundle"
```

---

## Task 2: Formatting helpers with tests (TDD)

**Files:**
- Create: `src/lib/i18n/format.ts`
- Create: `src/lib/i18n/format.test.ts`

- [ ] **Step 2.1: Write failing tests**

```ts
// src/lib/i18n/format.test.ts
import { describe, expect, it } from "vitest";
import { formatDate, formatEur } from "./format";

describe("formatEur", () => {
	it("formats cents as Finnish euros with non-breaking space and comma", () => {
		// Finnish locale uses NBSP (U+00A0) before the currency symbol and comma as decimal.
		expect(formatEur(4500)).toBe("45,00\u00a0€");
	});

	it("handles zero", () => {
		expect(formatEur(0)).toBe("0,00\u00a0€");
	});

	it("handles values under one euro", () => {
		expect(formatEur(50)).toBe("0,50\u00a0€");
	});
});

describe("formatDate", () => {
	it("formats a date in Finnish short style", () => {
		const d = new Date("2026-04-18T12:00:00Z");
		expect(formatDate(d)).toMatch(/18\.4\.2026|18\.04\.2026/);
	});

	it("accepts Intl options", () => {
		const d = new Date("2026-04-18T12:00:00Z");
		const out = formatDate(d, { month: "long", year: "numeric" });
		expect(out.toLowerCase()).toContain("huhtikuu");
	});
});
```

- [ ] **Step 2.2: Run tests — expect failure (module missing)**

```bash
pnpm vitest run src/lib/i18n/format.test.ts
```

Expected: FAIL — cannot find module `./format`.

- [ ] **Step 2.3: Implement `format.ts`**

```ts
// src/lib/i18n/format.ts
import i18n from "i18next";

function activeLocale(): string {
	return i18n.language || "fi";
}

export function formatEur(cents: number): string {
	const amount = cents / 100;
	return new Intl.NumberFormat(activeLocale(), {
		style: "currency",
		currency: "EUR",
	}).format(amount);
}

export function formatDate(d: Date, opts?: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(activeLocale(), opts).format(d);
}
```

- [ ] **Step 2.4: Run tests — expect pass**

```bash
pnpm vitest run src/lib/i18n/format.test.ts
```

Expected: 4 passing. If the NBSP assertion fails because the runtime ICU data emits a regular space, change the expectation to `/45,00\s?€/` — node's ICU build dictates the separator. Keep the test strict only if it passes on CI.

- [ ] **Step 2.5: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Both green.

- [ ] **Step 2.6: Commit**

```bash
git add src/lib/i18n/format.ts src/lib/i18n/format.test.ts
git commit -m "feat(i18n): formatEur and formatDate with Intl"
```

---

## Task 3: Server-side `createI18n` factory

**Files:**
- Create: `src/lib/i18n/server.ts`

- [ ] **Step 3.1: Implement `server.ts`**

```ts
// src/lib/i18n/server.ts
import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources, type SupportedLocale, supportedLngs } from "./resources";

export async function createI18n(locale: SupportedLocale): Promise<i18n> {
	const instance = i18next.createInstance();
	await instance.use(initReactI18next).init({
		lng: locale,
		fallbackLng: "fi",
		supportedLngs: [...supportedLngs],
		defaultNS,
		ns: Object.keys(resources.fi),
		resources,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
	return instance;
}
```

- [ ] **Step 3.2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/i18n/server.ts
git commit -m "feat(i18n): per-request createI18n factory"
```

---

## Task 4: Client bootstrap singleton

**Files:**
- Create: `src/lib/i18n/client.ts`

- [ ] **Step 4.1: Implement `client.ts`**

```ts
// src/lib/i18n/client.ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources, type SupportedLocale, supportedLngs } from "./resources";

declare global {
	interface Window {
		__I18N__?: { locale: SupportedLocale };
	}
}

let bootstrapped = false;

export function ensureClientI18n(): void {
	if (bootstrapped) return;
	bootstrapped = true;
	const locale: SupportedLocale = window.__I18N__?.locale ?? "fi";
	i18next.use(initReactI18next).init({
		lng: locale,
		fallbackLng: "fi",
		supportedLngs: [...supportedLngs],
		defaultNS,
		ns: Object.keys(resources.fi),
		resources,
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
}

export async function changeClientLocale(locale: SupportedLocale): Promise<void> {
	if (i18next.language !== locale) {
		await i18next.changeLanguage(locale);
	}
}

export { default as i18n } from "i18next";
```

- [ ] **Step 4.2: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/i18n/client.ts
git commit -m "feat(i18n): client bootstrap singleton"
```

---

## Task 5: Locale detection + router context + provider

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 5.1: Add locale detection in `beforeLoad` and wire provider**

Replace the `createRootRoute({...})` call and `RootDocument` in `src/routes/__root.tsx` as follows. Keep imports already in the file; add the new ones.

Top-of-file additions:

```tsx
import { I18nextProvider } from "react-i18next";
import { createI18n } from "~/lib/i18n/server";
import { ensureClientI18n, i18n as clientI18n, changeClientLocale } from "~/lib/i18n/client";
import type { SupportedLocale } from "~/lib/i18n";
```

Locale helper (above `createRootRoute`):

```tsx
function detectLocale(pathname: string): SupportedLocale {
	if (pathname === "/en" || pathname.startsWith("/en/")) return "fi"; // EN not shipped yet — falls back
	return "fi";
}
```

Change the route definition:

```tsx
export const Route = createRootRoute({
	beforeLoad: ({ location }) => {
		const locale = detectLocale(location.pathname);
		return { locale };
	},
	loader: async ({ context }) => {
		const session = await getSession();
		const i18n = typeof window === "undefined" ? await createI18n(context.locale) : clientI18n;
		return { session, locale: context.locale, i18n };
	},
	head: ({ loaderData }) => {
		const locale = loaderData?.locale ?? "fi";
		const ogLocale = locale === "fi" ? "fi_FI" : "en_US";
		return {
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
				{ property: "og:description", content: "Suomalainen moottoripyörien vuokrausilmoitukset." },
				{ property: "og:locale", content: ogLocale },
				{ name: "twitter:card", content: "summary_large_image" },
			],
			links: [
				{ rel: "stylesheet", href: appCss },
				{ rel: "manifest", href: "/manifest.webmanifest" },
				{ rel: "icon", href: "/favicon.ico", sizes: "any" },
				{ rel: "apple-touch-icon", href: "/icon-192.png" },
				{ rel: "preconnect", href: "https://fonts.googleapis.com" },
				{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
				{
					rel: "stylesheet",
					href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap",
				},
				{ rel: "alternate", hrefLang: "fi", href: "/" },
				{ rel: "alternate", hrefLang: "x-default", href: "/" },
			],
		};
	},
	component: RootComponent,
	notFoundComponent: NotFound,
});
```

Change `RootComponent` to pull i18n from loader data and wrap:

```tsx
function RootComponent() {
	useEffect(() => {
		document.documentElement.setAttribute("data-hydrated", "true");
	}, []);
	const { session, locale, i18n } = Route.useLoaderData();
	useEffect(() => {
		ensureClientI18n();
		void changeClientLocale(locale);
	}, [locale]);
	return (
		<I18nextProvider i18n={i18n}>
			<RootDocument session={session} locale={locale}>
				<Outlet />
			</RootDocument>
		</I18nextProvider>
	);
}
```

Change `RootDocument` to accept `locale`, inject `window.__I18N__`, and use `t()` for nav labels and the 404:

```tsx
interface RootDocumentProps {
	children: ReactNode;
	session?: Awaited<ReturnType<typeof getSession>>;
	locale: SupportedLocale;
}

function RootDocument({ children, session, locale }: RootDocumentProps) {
	const router = useRouter();
	const [loginOpen, setLoginOpen] = useState(false);
	const { t } = useTranslation("common");

	async function handleSignOut() {
		await signOut();
		router.invalidate();
		router.navigate({ to: "/" });
	}

	return (
		<html lang={locale}>
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
								{t("nav.browse")}
							</Link>
							<Link
								to="/listings/new"
								className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
							>
								{t("nav.listMotorcycle")}
							</Link>
							{session ? (
								<>
									<Link
										data-testid="nav-dashboard"
										to="/dashboard"
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
				{children}
				<LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
				<Scripts />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: inline locale for hydration
					dangerouslySetInnerHTML={{
						__html: `window.__I18N__=${JSON.stringify({ locale })};`,
					}}
				/>
			</body>
		</html>
	);
}
```

Update `NotFound` to take a `locale` prop so it still renders with the shell (fallback to `"fi"` when the loader hasn't run):

```tsx
function NotFound() {
	return (
		<RootDocument locale="fi">
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
```

(404 keeps hardcoded Finnish — when `t()` runs without an I18nextProvider it would throw. This is the intentional "no loader ran" fallback.)

- [ ] **Step 5.2: Typecheck, lint, and smoke-run dev server**

```bash
pnpm typecheck && pnpm lint && pnpm dev
```

In another terminal:

```bash
curl -s http://localhost:3000/ | grep -E '<html lang|hreflang|og:locale'
```

Expected: `<html lang="fi">`, `<link rel="alternate" hreflang="fi" ...>`, `<meta property="og:locale" content="fi_FI">`. Kill the dev server when confirmed.

- [ ] **Step 5.3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(i18n): SSR locale detection, provider, and SEO head tags"
```

---

## Task 6: Extract `home` namespace

**Files:**
- Modify: `src/lib/i18n/resources/fi/home.ts`
- Modify: `src/routes/index.tsx`

- [ ] **Step 6.1: Read the current file**

```bash
# Use Read tool on src/routes/index.tsx
```

- [ ] **Step 6.2: Populate `home.ts`**

Add every visible Finnish string to a nested key tree keyed by section (`hero`, `features`, `cta`, etc.). Shape it to mirror the page structure — one key per piece of copy. Example:

```ts
// src/lib/i18n/resources/fi/home.ts
export default {
	hero: {
		heading: "Vuokraa moottoripyörä Suomessa",
		subheading: "...",
		browseCta: "Selaa ilmoituksia",
		listCta: "Ilmoita pyörä",
	},
	features: {
		// ... one key per string found in the file
	},
} as const;
```

Extract the **exact** strings from `src/routes/index.tsx`; don't paraphrase.

- [ ] **Step 6.3: Replace hardcoded strings in `routes/index.tsx` with `useTranslation("home")` + `t("...")`**

Add at top of component:

```tsx
import { useTranslation } from "~/lib/i18n";
// inside component:
const { t } = useTranslation("home");
```

Replace every Finnish string with the matching `t("section.key")`.

- [ ] **Step 6.4: Typecheck (catches typos in keys)**

```bash
pnpm typecheck
```

Any unknown key is a TS error. Fix by aligning the key tree in `home.ts` with the call sites.

- [ ] **Step 6.5: Smoke-test**

```bash
pnpm dev
# Visit http://localhost:3000/ in browser; confirm text renders unchanged.
```

- [ ] **Step 6.6: Commit**

```bash
git add src/lib/i18n/resources/fi/home.ts src/routes/index.tsx
git commit -m "refactor(i18n): extract home page strings"
```

---

## Task 7: Extract `listings` namespace

**Files:**
- Modify: `src/lib/i18n/resources/fi/listings.ts`
- Modify: `src/routes/listings/index.tsx`
- Modify: `src/routes/listings/new.tsx`
- Modify: `src/routes/listings/$listingId.tsx`
- Modify: `src/routes/listings/$listingId_.edit.tsx`
- Modify: `src/components/listings/empty-state.tsx`
- Modify: `src/components/listings/filter-drawer.tsx`
- Modify: `src/components/listings/filter-sidebar.tsx`
- Modify: `src/components/listings/listing-card.tsx`
- Modify: `src/components/listings/listing-card-skeleton.tsx`
- Modify: `src/components/listings/listing-form.tsx`

- [ ] **Step 7.1: Populate `listings.ts` key tree**

Organize by section: `browse` (list page + filters), `detail`, `create`, `edit`, `card`, `empty`, `form`. One key per string. Read every file above and extract exact strings.

- [ ] **Step 7.2: Replace hardcoded strings file-by-file**

In each file, add `const { t } = useTranslation("listings");` inside the component (import from `~/lib/i18n`) and swap strings. Do one file at a time and `pnpm typecheck` after each to catch typos.

- [ ] **Step 7.3: Replace any ad-hoc EUR/date formatting with `formatEur`/`formatDate`**

Grep within these files for `.toFixed`, `toLocaleString`, `€`, and manual `/100` computations. Replace with `formatEur(cents)` / `formatDate(date)` from `~/lib/i18n`.

- [ ] **Step 7.4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 7.5: Smoke-test**

```bash
pnpm dev
# Visit /listings, /listings/new, a detail page, an edit page. Confirm all Finnish text renders.
```

- [ ] **Step 7.6: Commit**

```bash
git add src/lib/i18n/resources/fi/listings.ts src/routes/listings src/components/listings
git commit -m "refactor(i18n): extract listings strings and adopt formatEur/formatDate"
```

---

## Task 8: Extract `auth` namespace

**Files:**
- Modify: `src/lib/i18n/resources/fi/auth.ts`
- Modify: `src/routes/auth/login.tsx`
- Modify: `src/routes/auth/register.tsx`
- Modify: `src/routes/auth/verify-email.tsx`
- Modify: `src/routes/auth/complete-profile.tsx`
- Modify: `src/components/auth/login-form.tsx`
- Modify: `src/components/auth/login-modal.tsx`

- [ ] **Step 8.1: Populate `auth.ts`**

Organize by section: `login`, `register`, `verifyEmail`, `completeProfile`, `modal`. Extract exact strings from the files above.

- [ ] **Step 8.2: Replace strings file-by-file with `useTranslation("auth")`**

Typecheck after each file.

- [ ] **Step 8.3: Out of scope (note in BACKLOG.md)**

The email bodies in `src/lib/auth.ts` and `src/lib/email.ts` are server-side and fire before a request context exists in some cases. Keep them as hardcoded Finnish for now. Add a BACKLOG.md entry:

```markdown
- i18n email templates: currently hardcoded Finnish in `src/lib/auth.ts` and `src/lib/email.ts`. Route through i18n resources when multi-locale emails are needed.
```

- [ ] **Step 8.4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/i18n/resources/fi/auth.ts src/routes/auth src/components/auth BACKLOG.md
git commit -m "refactor(i18n): extract auth strings"
```

---

## Task 9: Extract `profile` namespace (dashboard, public profile, settings)

**Files:**
- Modify: `src/lib/i18n/resources/fi/profile.ts`
- Modify: `src/routes/dashboard/index.tsx`
- Modify: `src/routes/profile/$userId.tsx`
- Modify: `src/routes/profile/settings.tsx`

- [ ] **Step 9.1: Populate `profile.ts`**

Organize by section: `dashboard`, `publicProfile`, `settings`. Extract exact strings.

- [ ] **Step 9.2: Replace strings with `useTranslation("profile")`**

- [ ] **Step 9.3: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/i18n/resources/fi/profile.ts src/routes/dashboard src/routes/profile
git commit -m "refactor(i18n): extract dashboard, profile, and settings strings"
```

---

## Task 10: Extract strings from `components/ui` and audit leftovers

**Files:**
- Modify (if any hardcoded Finnish found): `src/components/ui/*.tsx`
- Modify: `src/lib/i18n/resources/fi/common.ts` (add any leftover generic strings)

- [ ] **Step 10.1: Grep for remaining hardcoded Finnish**

Use the Grep tool with pattern `[äöåÄÖÅ]` across `src/components/` and `src/routes/` (excluding `api/`, `i18n/`) to find any remaining Finnish. For each hit, either:
	- Move the string to the most appropriate namespace (`common` for truly generic), OR
	- Document why it's intentionally left hardcoded (filename, comment, etc.).

Also grep for common Finnish words that don't contain diacritics: `Peruuta`, `Tallenna`, `Poista`, `Muokkaa`, `Kirjaudu`, `Selaa`, `Ilmoita`. Any hit is a miss from earlier tasks — extract it.

- [ ] **Step 10.2: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 10.3: Commit (if changes)**

```bash
git add -A
git commit -m "refactor(i18n): extract remaining hardcoded strings"
```

---

## Task 11: Rename `listings` routes to `ilmoitukset`

**Files:**
- Rename: `src/routes/listings/index.tsx` → `src/routes/ilmoitukset/index.tsx`
- Rename: `src/routes/listings/new.tsx` → `src/routes/ilmoitukset/uusi.tsx`
- Rename: `src/routes/listings/$listingId.tsx` → `src/routes/ilmoitukset/$listingId.tsx`
- Rename: `src/routes/listings/$listingId_.edit.tsx` → `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`
- Modify: every caller referencing `/listings/...` (internal links, redirects)
- Modify: `e2e/pages/listings.page.ts`, `e2e/pages/listing-detail.page.ts`, `e2e/tests/listings.spec.ts`, `e2e/tests/home.spec.ts`, `e2e/global-setup.ts`

- [ ] **Step 11.1: Git-aware rename**

```bash
mkdir -p src/routes/ilmoitukset
git mv src/routes/listings/index.tsx src/routes/ilmoitukset/index.tsx
git mv src/routes/listings/new.tsx src/routes/ilmoitukset/uusi.tsx
git mv src/routes/listings/$listingId.tsx src/routes/ilmoitukset/\$listingId.tsx
git mv src/routes/listings/\$listingId_.edit.tsx src/routes/ilmoitukset/\$listingId_.muokkaa.tsx
rmdir src/routes/listings
```

- [ ] **Step 11.2: Update all internal references**

Use Grep to find `"/listings"` across `src/`:

```bash
# Grep tool: pattern `["'\`]/listings`, path `src/`
```

For each hit, replace `/listings` → `/ilmoitukset`, `/listings/new` → `/ilmoitukset/uusi`, `/listings/$listingId/edit` → `/ilmoitukset/$listingId/muokkaa`. Files that will need changes include `__root.tsx` (nav), `index.tsx` (home CTAs), `empty-state.tsx`, `listing-card.tsx`, `listing-form.tsx`, `login.tsx`, `$listingId.tsx`, `$listingId_.muokkaa.tsx`, etc.

TanStack Router's `Link to="..."` is typed — mistyped paths are a TS error after regen, which is a feature.

- [ ] **Step 11.3: Regenerate route tree**

```bash
rm src/routeTree.gen.ts
pnpm dev
# Wait ~3s for route tree regeneration, confirm src/routeTree.gen.ts reappears, then Ctrl+C.
```

- [ ] **Step 11.4: Update E2E tests**

In `e2e/`, grep for `/listings` and replace as above. Visible Finnish text assertions (e.g. `"Selaa ilmoituksia"`) are unchanged.

- [ ] **Step 11.5: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

Any routing error surfaces here. Fix by chasing missed `/listings` references.

- [ ] **Step 11.6: Commit**

```bash
git add -A
git commit -m "chore(i18n): rename /listings routes to /ilmoitukset"
```

---

## Task 12: Rename `auth/*` routes to Finnish root-level paths

**Files:**
- Rename: `src/routes/auth/login.tsx` → `src/routes/kirjaudu.tsx`
- Rename: `src/routes/auth/register.tsx` → `src/routes/rekisteroidy.tsx`
- Rename: `src/routes/auth/verify-email.tsx` → `src/routes/vahvista-sahkoposti.tsx`
- Rename: `src/routes/auth/complete-profile.tsx` → `src/routes/taydenna-profiili.tsx`
- Modify: BetterAuth redirect URLs, all `/auth/*` link/redirect references
- Modify: `e2e/pages/login.page.ts`, `e2e/pages/register.page.ts`, `e2e/tests/auth.spec.ts`

- [ ] **Step 12.1: Git-aware rename**

```bash
git mv src/routes/auth/login.tsx src/routes/kirjaudu.tsx
git mv src/routes/auth/register.tsx src/routes/rekisteroidy.tsx
git mv src/routes/auth/verify-email.tsx src/routes/vahvista-sahkoposti.tsx
git mv src/routes/auth/complete-profile.tsx src/routes/taydenna-profiili.tsx
# Keep src/routes/auth/ for api/auth/** — it stays untouched.
# But src/routes/auth/ no longer has .tsx children; verify:
ls src/routes/auth
```

If `src/routes/auth/` is now empty (no non-api children), that's fine — there's no directory route. The `api/auth/` tree lives under `src/routes/api/auth/`, which is a separate path.

- [ ] **Step 12.2: Update BetterAuth redirect targets**

Search for `/auth/` across `src/`:

```bash
# Grep tool: pattern `/auth/(login|register|verify-email|complete-profile)`, path `src/`
```

Update each reference. Expected hits include the email verification URL in `src/lib/auth.ts`, any `redirect({ to: "/auth/login" })` in loaders, and links in `login-form.tsx` / `login-modal.tsx`.

**Important:** `src/routes/api/auth/` is unchanged — those are BetterAuth handler routes, not user-facing.

- [ ] **Step 12.3: Update E2E tests**

In `e2e/`, replace `/auth/login` → `/kirjaudu`, `/auth/register` → `/rekisteroidy`, `/auth/verify-email` → `/vahvista-sahkoposti`, `/auth/complete-profile` → `/taydenna-profiili`.

- [ ] **Step 12.4: Regenerate route tree**

```bash
rm src/routeTree.gen.ts
pnpm dev
# Confirm regen, then Ctrl+C.
```

- [ ] **Step 12.5: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 12.6: Manual smoke**

```bash
pnpm dev
# Open /kirjaudu, /rekisteroidy; log in and verify the full flow.
# Trigger a verification email locally (with DISABLE_EMAIL_VERIFICATION=false) — confirm the link points at /vahvista-sahkoposti.
```

- [ ] **Step 12.7: Commit**

```bash
git add -A
git commit -m "chore(i18n): rename auth routes to Finnish and update redirects"
```

---

## Task 13: Rename dashboard + profile routes

**Files:**
- Rename: `src/routes/dashboard/index.tsx` → `src/routes/omat/index.tsx`
- Rename: `src/routes/profile/$userId.tsx` → `src/routes/profiili/$userId.tsx`
- Rename: `src/routes/profile/settings.tsx` → `src/routes/profiili/asetukset.tsx`
- Modify: all `/dashboard` and `/profile/...` references (including nav `data-testid="nav-dashboard"` link)

- [ ] **Step 13.1: Git-aware rename**

```bash
mkdir -p src/routes/omat src/routes/profiili
git mv src/routes/dashboard/index.tsx src/routes/omat/index.tsx
git mv src/routes/profile/\$userId.tsx src/routes/profiili/\$userId.tsx
git mv src/routes/profile/settings.tsx src/routes/profiili/asetukset.tsx
rmdir src/routes/dashboard src/routes/profile
```

- [ ] **Step 13.2: Update references**

Grep for `/dashboard` and `/profile` across `src/` and `e2e/`, excluding `/api/`. Replace `/dashboard` → `/omat`, `/profile/` → `/profiili/`, `/profile/settings` → `/profiili/asetukset`.

- [ ] **Step 13.3: Regenerate route tree**

```bash
rm src/routeTree.gen.ts
pnpm dev
# Confirm regen, then Ctrl+C.
```

- [ ] **Step 13.4: Verify**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- [ ] **Step 13.5: Commit**

```bash
git add -A
git commit -m "chore(i18n): rename dashboard to /omat and profile to /profiili"
```

---

## Task 14: Final verification pass

**Files:** none (verification only)

- [ ] **Step 14.1: All checks green**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```

- [ ] **Step 14.2: Manual head inspection**

```bash
pnpm dev
# In another terminal:
curl -s http://localhost:3000/ | grep -E '<html lang|hreflang|og:locale|window.__I18N__'
```

Expected to contain:
- `<html lang="fi">`
- `<link rel="alternate" hreflang="fi" ...>`
- `<link rel="alternate" hreflang="x-default" ...>`
- `<meta property="og:locale" content="fi_FI">`
- `<script>window.__I18N__={"locale":"fi"};</script>`

- [ ] **Step 14.3: Manual UI audit**

Click through: `/`, `/ilmoitukset`, `/ilmoitukset/uusi` (logged in), a listing detail, `/omat`, `/profiili/asetukset`, `/kirjaudu`, `/rekisteroidy`. Confirm no English UI strings remain (nav, buttons, labels, errors, 404).

- [ ] **Step 14.4: Grep for stray English artefacts**

```bash
# Grep tool on src/, excluding src/lib/i18n and node_modules:
# patterns: "Sign in", "Register", "Dashboard", "Profile", "Listings", "Settings"
# Any hit: extract or justify.
```

- [ ] **Step 14.5: Commit any fallout**

```bash
git add -A
git commit -m "chore(i18n): final cleanup after verification"
# (skip if no changes)
```

- [ ] **Step 14.6: Update BACKLOG.md**

Remove the completed i18n items; confirm deferred items from the spec's "Explicitly out of scope" are present (EN catalog, language switcher, path-mapping layer, email templates through i18n, translation management tooling, old-path redirects).

```bash
git add BACKLOG.md
git commit -m "chore: update backlog post-localization"
# (skip if no changes)
```

---

## Verification checklist

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `pnpm test` all pass
- [ ] `pnpm test:e2e` all pass
- [ ] `pnpm build` succeeds
- [ ] `curl / | grep` shows `<html lang="fi">`, both `hreflang` links, `og:locale`, injected `window.__I18N__`
- [ ] No English UI strings on any page in manual walkthrough
- [ ] All renamed route URLs reachable; old paths 404 (expected — no redirects, per spec)
- [ ] BetterAuth login/register/verify flows work end-to-end against new URLs
