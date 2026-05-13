# Mobile Bottom Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-only bottom navigation bar with a Search overlay, and slim the top nav to logo + language selector under `md`.

**Architecture:** Two new client components (`BottomNav`, `MobileSearchOverlay`) mounted from `src/routes/__root.tsx`, hidden at `md+`. Two small pure utilities (`active-tab`, `recent-searches`) are extracted for unit testing. Search submits to existing `/pyorat/myynti?q=...` (FTS already supported by `browseSearchSchema` + `searchListings`).

**Tech Stack:** TanStack Start (React 19), Tailwind, `lucide-react` icons, react-i18next, Vitest, Playwright. Package manager: `pnpm`.

**Branch:** `feat/mobile-bottom-nav` (spec already committed). All commits land here; no rebases against `main` mid-plan.

**Per-task verification (per user preference):** run only `pnpm typecheck` + relevant `pnpm test` after each task. Lint/format and full e2e run **once** at the end.

---

## File Structure

New:

- `src/lib/recent-searches.ts` — pure helpers around `localStorage` key `motori:recentSearches`.
- `src/lib/recent-searches.test.ts` — unit tests.
- `src/components/nav/active-tab.ts` — pure matcher: `(pathname) => "browse" | "bookings" | "account" | null`.
- `src/components/nav/active-tab.test.ts` — unit tests.
- `src/components/nav/bottom-nav.tsx` — the bar.
- `src/components/nav/mobile-search-overlay.tsx` — full-screen sheet.
- `e2e/tests/mobile-bottom-nav.spec.ts` — Playwright e2e (mobile project).

Modified:

- `src/routes/__root.tsx` — slim top nav under `md`, mount bottom nav, manage overlay state, add `pb-16 md:pb-0` to `<main>`.
- `src/lib/i18n/resources/fi/common.ts` — add `nav.bottom.*` + `search.*` keys.
- `src/lib/i18n/resources/en/common.ts` — same keys, English.
- `playwright.config.ts` — add the new spec to the `mobile` project's `testMatch`.

---

## Task 1: i18n keys for bottom nav and search overlay

**Files:**
- Modify: `src/lib/i18n/resources/fi/common.ts`
- Modify: `src/lib/i18n/resources/en/common.ts`

- [ ] **Step 1: Add Finnish keys**

Open `src/lib/i18n/resources/fi/common.ts`. Inside the `nav: { ... }` object, after the existing `switchLanguage` line, add:

```ts
		bottom: {
			browse: "Selaa",
			search: "Haku",
			add: "Lisää",
			bookings: "Varaukset",
			account: "Tili",
			ariaLabel: "Mobiilinavigaatio",
		},
		search: {
			title: "Haku",
			close: "Sulje haku",
			placeholder: "Etsi pyöriä, varusteita...",
			submit: "Hae",
			categories: "Kategoriat",
			cities: "Kaupungit",
			recent: "Viimeisimmät haut",
		},
```

- [ ] **Step 2: Add English keys**

Open `src/lib/i18n/resources/en/common.ts`. Add the matching block inside `nav`:

```ts
		bottom: {
			browse: "Browse",
			search: "Search",
			add: "Add",
			bookings: "Bookings",
			account: "Account",
			ariaLabel: "Mobile navigation",
		},
		search: {
			title: "Search",
			close: "Close search",
			placeholder: "Search bikes, gear...",
			submit: "Search",
			categories: "Categories",
			cities: "Cities",
			recent: "Recent searches",
		},
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS (i18n types are inferred from the fi resources file via `react-i18next.d.ts`, so adding keys to fi must be mirrored in en for parity).

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/resources/fi/common.ts src/lib/i18n/resources/en/common.ts
git commit -m "i18n: keys for mobile bottom nav and search overlay"
```

---

## Task 2: Recent-searches utility (TDD)

**Files:**
- Create: `src/lib/recent-searches.ts`
- Create: `src/lib/recent-searches.test.ts`

Three pure functions backed by `localStorage`:
- `getRecentSearches(): string[]` — returns array (max 5), newest first, `[]` if nothing or parse error.
- `addRecentSearch(q: string): string[]` — trims, ignores empty, dedupes (case-insensitive), prepends, caps at 5, writes back, returns new list.
- `clearRecentSearches(): void` — removes the key.

Storage key: `motori:recentSearches`. All functions must be SSR-safe (`typeof window === "undefined"` → `[]` or no-op).

- [ ] **Step 1: Write failing tests**

Create `src/lib/recent-searches.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
	addRecentSearch,
	clearRecentSearches,
	getRecentSearches,
} from "./recent-searches";

describe("recent-searches", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns empty array when nothing stored", () => {
		expect(getRecentSearches()).toEqual([]);
	});

	it("returns empty array on parse error", () => {
		localStorage.setItem("motori:recentSearches", "not-json");
		expect(getRecentSearches()).toEqual([]);
	});

	it("adds a search and returns the new list", () => {
		const result = addRecentSearch("honda");
		expect(result).toEqual(["honda"]);
		expect(getRecentSearches()).toEqual(["honda"]);
	});

	it("prepends newest, dedupes case-insensitively", () => {
		addRecentSearch("honda");
		addRecentSearch("yamaha");
		const result = addRecentSearch("Honda");
		expect(result).toEqual(["Honda", "yamaha"]);
	});

	it("caps at 5 entries", () => {
		for (const q of ["a", "b", "c", "d", "e", "f"]) addRecentSearch(q);
		expect(getRecentSearches()).toEqual(["f", "e", "d", "c", "b"]);
	});

	it("ignores empty and whitespace-only input", () => {
		expect(addRecentSearch("")).toEqual([]);
		expect(addRecentSearch("   ")).toEqual([]);
		expect(getRecentSearches()).toEqual([]);
	});

	it("trims the stored value", () => {
		addRecentSearch("  honda  ");
		expect(getRecentSearches()).toEqual(["honda"]);
	});

	it("clears all entries", () => {
		addRecentSearch("honda");
		clearRecentSearches();
		expect(getRecentSearches()).toEqual([]);
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/lib/recent-searches.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

Create `src/lib/recent-searches.ts`:

```ts
const KEY = "motori:recentSearches";
const MAX = 5;

function isBrowser(): boolean {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecentSearches(): string[] {
	if (!isBrowser()) return [];
	const raw = window.localStorage.getItem(KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
	} catch {
		return [];
	}
}

export function addRecentSearch(q: string): string[] {
	const trimmed = q.trim();
	if (!trimmed) return getRecentSearches();
	const current = getRecentSearches();
	const filtered = current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
	const next = [trimmed, ...filtered].slice(0, MAX);
	if (isBrowser()) {
		window.localStorage.setItem(KEY, JSON.stringify(next));
	}
	return next;
}

export function clearRecentSearches(): void {
	if (!isBrowser()) return;
	window.localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/lib/recent-searches.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recent-searches.ts src/lib/recent-searches.test.ts
git commit -m "feat(nav): recent-searches localStorage helpers"
```

---

## Task 3: Active-tab matcher (TDD)

**Files:**
- Create: `src/components/nav/active-tab.ts`
- Create: `src/components/nav/active-tab.test.ts`

Pure function `getActiveTab(pathname: string): "browse" | "bookings" | "account" | null`. Browse uses exact match for `/`. Bookings = paths starting with `/omat`. Account = paths starting with `/asetukset`. Anything else = `null`.

- [ ] **Step 1: Write failing tests**

Create `src/components/nav/active-tab.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getActiveTab } from "./active-tab";

describe("getActiveTab", () => {
	it("returns 'browse' only for exact '/'", () => {
		expect(getActiveTab("/")).toBe("browse");
		expect(getActiveTab("/pyorat/myynti")).toBe(null);
	});

	it("returns 'bookings' for /omat and sub-paths", () => {
		expect(getActiveTab("/omat")).toBe("bookings");
		expect(getActiveTab("/omat/varaukset")).toBe("bookings");
	});

	it("returns 'account' for /asetukset and sub-paths", () => {
		expect(getActiveTab("/asetukset")).toBe("account");
		expect(getActiveTab("/asetukset/profile")).toBe("account");
	});

	it("returns null for unrelated routes", () => {
		expect(getActiveTab("/ilmoitukset/uusi")).toBe(null);
		expect(getActiveTab("/varusteet")).toBe(null);
	});
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm test src/components/nav/active-tab.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

Create `src/components/nav/active-tab.ts`:

```ts
export type ActiveTab = "browse" | "bookings" | "account";

export function getActiveTab(pathname: string): ActiveTab | null {
	if (pathname === "/") return "browse";
	if (pathname === "/omat" || pathname.startsWith("/omat/")) return "bookings";
	if (pathname === "/asetukset" || pathname.startsWith("/asetukset/")) return "account";
	return null;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm test src/components/nav/active-tab.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/active-tab.ts src/components/nav/active-tab.test.ts
git commit -m "feat(nav): active-tab matcher for mobile bottom nav"
```

---

## Task 4: `MobileSearchOverlay` component

**Files:**
- Create: `src/components/nav/mobile-search-overlay.tsx`

A full-screen modal. Renders nothing when `open === false`. When open:

- Locks body scroll (`document.body.style.overflow = "hidden"` on mount, restore on cleanup).
- Autofocuses the input.
- Escape closes.
- On submit: `addRecentSearch(q)`, navigate to `/pyorat/myynti?q=<q>`, call `onClose()`.
- Category cards (2×2 grid): Myynti → `/pyorat/myynti`, Vuokraus → `/pyorat/vuokraus`, Varusteet → `/varusteet`, Varaosat → `/varaosat`. Each closes the overlay on click.
- `CitySelect` reused; on change navigates to `/pyorat/myynti?city=<city>` and closes.
- Recent searches list (newest first), tapping a row re-runs that query. Hidden when empty.

Uses `useNavigate()` from `@tanstack/react-router`. Translations via `useTranslation()` keys `nav.search.*` (close, placeholder, submit, categories, cities, recent) plus `nav.bottom.search` for the title — wait, the title key is `nav.search.title` per Task 1. Use `nav.search.title`.

Props:

```ts
type Props = { open: boolean; onClose: () => void };
```

- [ ] **Step 1: Implement the component**

Create `src/components/nav/mobile-search-overlay.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CitySelect } from "~/components/listings/city-select";
import { addRecentSearch, getRecentSearches } from "~/lib/recent-searches";

type Props = { open: boolean; onClose: () => void };

const CATEGORIES = [
	{ key: "sale", to: "/pyorat/myynti" },
	{ key: "rental", to: "/pyorat/vuokraus" },
	{ key: "gear", to: "/varusteet" },
	{ key: "parts", to: "/varaosat" },
] as const;

export function MobileSearchOverlay({ open, onClose }: Props) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const [q, setQ] = useState("");
	const [recent, setRecent] = useState<string[]>([]);

	useEffect(() => {
		if (!open) return;
		setRecent(getRecentSearches());
		setQ("");
		document.body.style.overflow = "hidden";
		const t0 = window.setTimeout(() => inputRef.current?.focus(), 0);
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = "";
			window.removeEventListener("keydown", onKey);
			window.clearTimeout(t0);
		};
	}, [open, onClose]);

	if (!open) return null;

	function runQuery(query: string) {
		const trimmed = query.trim();
		if (!trimmed) return;
		addRecentSearch(trimmed);
		navigate({ to: "/pyorat/myynti", search: { q: trimmed } });
		onClose();
	}

	function goCategory(to: string) {
		navigate({ to });
		onClose();
	}

	function goCity(city: string) {
		if (!city) return;
		navigate({ to: "/pyorat/myynti", search: { city } });
		onClose();
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={t("nav.search.title")}
			className="fixed inset-0 z-50 flex flex-col bg-background"
		>
			<header className="flex items-center gap-2 border-b border-border px-4 py-3">
				<h2 className="flex-1 text-base font-semibold">{t("nav.search.title")}</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label={t("nav.search.close")}
					className="rounded-md p-2 text-muted hover:text-foreground"
				>
					<X size={20} />
				</button>
			</header>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					runQuery(q);
				}}
				className="border-b border-border px-4 py-3"
			>
				<div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
					<SearchIcon size={18} className="text-muted" />
					<input
						ref={inputRef}
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t("nav.search.placeholder")}
						className="flex-1 bg-transparent outline-none"
					/>
					<button type="submit" className="text-sm font-medium text-accent">
						{t("nav.search.submit")}
					</button>
				</div>
			</form>

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<section>
					<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
						{t("nav.search.categories")}
					</h3>
					<div className="grid grid-cols-2 gap-2">
						{CATEGORIES.map((c) => (
							<button
								key={c.key}
								type="button"
								onClick={() => goCategory(c.to)}
								className="rounded-md border border-border bg-background px-3 py-3 text-left text-sm font-medium hover:bg-accent/5"
							>
								{t(`nav.${c.key === "sale" ? "sale" : c.key === "rental" ? "rental" : c.key}` as const)}
							</button>
						))}
					</div>
				</section>

				<section className="mt-6">
					<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
						{t("nav.search.cities")}
					</h3>
					<CitySelect value="" onChange={goCity} id="mobile-search-city" />
				</section>

				{recent.length > 0 && (
					<section className="mt-6">
						<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
							{t("nav.search.recent")}
						</h3>
						<ul className="divide-y divide-border">
							{recent.map((r) => (
								<li key={r}>
									<button
										type="button"
										onClick={() => runQuery(r)}
										className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-accent"
									>
										<SearchIcon size={16} className="text-muted" />
										{r}
									</button>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</div>
	);
}
```

NOTE: the `t()` call for category labels in the grid is a bit awkward because `nav.sale` / `nav.rental` / `nav.gear` / `nav.parts` all exist already. Simplify to:

```tsx
{t(`nav.${c.key}` as const)}
```

…and use keys `sale | rental | gear | parts` (those already exist in `nav` per `src/lib/i18n/resources/fi/common.ts`). Replace the inline ternary above with the simplified version when implementing.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/mobile-search-overlay.tsx
git commit -m "feat(nav): mobile search overlay"
```

---

## Task 5: `BottomNav` component

**Files:**
- Create: `src/components/nav/bottom-nav.tsx`

5 tabs. Container fixed to viewport bottom, hidden at `md+`. Active state via `getActiveTab(pathname)` (Task 3). Add tab is visually elevated.

Props:

```ts
type Props = {
	session: { user: { id: string } } | null;
	verified: boolean;
	onSearchClick: () => void;
	onSignInClick: () => void;
};
```

Behavior:
- Browse: `<Link to="/">`
- Search: `<button onClick={onSearchClick}>`
- Add:
  - if `!session`: `<button onClick={onSignInClick}>`
  - if `session && verified`: `<Link to="/ilmoitukset/uusi">`
  - if `session && !verified`: `<button>` (no-op; same visual disabled state used elsewhere is acceptable — keep simple, just call `onSignInClick` so user is reminded? No — spec says unverified gets a tooltip + no-op today. For v1 mobile keep the existing flow: `<button>` with `title` attribute, no action.)
- Bookings: if `!session` → `onSignInClick`; else `<Link to="/omat">`.
- Account: if `!session` → `onSignInClick`; else `<Link to="/asetukset">`.

- [ ] **Step 1: Implement**

Create `src/components/nav/bottom-nav.tsx`:

```tsx
import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, Home, Plus, Search, User } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getActiveTab } from "./active-tab";

type Props = {
	session: { user: { id: string } } | null;
	verified: boolean;
	onSearchClick: () => void;
	onSignInClick: () => void;
};

export function BottomNav({ session, verified, onSearchClick, onSignInClick }: Props) {
	const { t } = useTranslation();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const active = getActiveTab(pathname);

	const labelBrowse = t("nav.bottom.browse");
	const labelSearch = t("nav.bottom.search");
	const labelAdd = t("nav.bottom.add");
	const labelBookings = t("nav.bottom.bookings");
	const labelAccount = t("nav.bottom.account");

	return (
		<nav
			aria-label={t("nav.bottom.ariaLabel")}
			className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
		>
			<TabLink to="/" label={labelBrowse} active={active === "browse"}>
				<Home size={22} />
			</TabLink>

			<TabButton label={labelSearch} onClick={onSearchClick}>
				<Search size={22} />
			</TabButton>

			{/* Add — visually elevated */}
			{!session ? (
				<TabButton label={labelAdd} onClick={onSignInClick} elevated>
					<Plus size={22} />
				</TabButton>
			) : verified ? (
				<TabLink to="/ilmoitukset/uusi" label={labelAdd} active={false} elevated>
					<Plus size={22} />
				</TabLink>
			) : (
				<TabButton label={labelAdd} onClick={() => {}} elevated disabled>
					<Plus size={22} />
				</TabButton>
			)}

			{!session ? (
				<TabButton label={labelBookings} onClick={onSignInClick}>
					<Calendar size={22} />
				</TabButton>
			) : (
				<TabLink to="/omat" label={labelBookings} active={active === "bookings"}>
					<Calendar size={22} />
				</TabLink>
			)}

			{!session ? (
				<TabButton label={labelAccount} onClick={onSignInClick}>
					<User size={22} />
				</TabButton>
			) : (
				<TabLink to="/asetukset" label={labelAccount} active={active === "account"}>
					<User size={22} />
				</TabLink>
			)}
		</nav>
	);
}

function tabClass(active: boolean): string {
	return [
		"flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs",
		active ? "text-accent" : "text-muted",
	].join(" ");
}

function TabLink({
	to,
	label,
	active,
	elevated,
	children,
}: {
	to: string;
	label: string;
	active: boolean;
	elevated?: boolean;
	children: ReactNode;
}) {
	return (
		<Link
			to={to}
			aria-current={active ? "page" : undefined}
			className={tabClass(active)}
			data-testid={`bottom-nav-${label.toLowerCase()}`}
		>
			<IconWrap elevated={elevated}>{children}</IconWrap>
			<span>{label}</span>
		</Link>
	);
}

function TabButton({
	label,
	onClick,
	elevated,
	disabled,
	children,
}: {
	label: string;
	onClick: () => void;
	elevated?: boolean;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			className={tabClass(false)}
			data-testid={`bottom-nav-${label.toLowerCase()}`}
		>
			<IconWrap elevated={elevated} dim={disabled}>{children}</IconWrap>
			<span>{label}</span>
		</button>
	);
}

function IconWrap({
	elevated,
	dim,
	children,
}: {
	elevated?: boolean;
	dim?: boolean;
	children: ReactNode;
}) {
	if (elevated) {
		return (
			<span
				className={[
					"flex h-9 w-9 items-center justify-center rounded-full text-white",
					dim ? "bg-muted/40" : "bg-accent",
				].join(" ")}
			>
				{children}
			</span>
		);
	}
	return <span>{children}</span>;
}
```

NOTE on `data-testid`: lowercased translated label is locale-dependent. Use stable test ids instead — switch to constants:

```tsx
data-testid="bottom-nav-browse" // etc.
```

Set each one to a hardcoded literal matching the tab role (`browse`, `search`, `add`, `bookings`, `account`). Do this when implementing — the lower-cased label was illustrative.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/bottom-nav.tsx
git commit -m "feat(nav): mobile bottom navigation bar"
```

---

## Task 6: Slim top nav and mount bottom nav in `__root.tsx`

**Files:**
- Modify: `src/routes/__root.tsx`

Two changes:

A. Wrap the existing nav inner row links in a `hidden md:flex` so they collapse on mobile; keep logo + `LanguageSelector` visible always.

B. After `<main>...</main>` and before the `<footer>`, mount `<BottomNav>` and `<MobileSearchOverlay>` (both inside the `!isAdmin` gate). Add a `searchOpen` state.

- [ ] **Step 1: Imports + state**

In `src/routes/__root.tsx`, add to the existing imports near the top:

```tsx
import { BottomNav } from "~/components/nav/bottom-nav";
import { MobileSearchOverlay } from "~/components/nav/mobile-search-overlay";
```

In the `RootDocument` component body, near the existing `const [loginOpen, setLoginOpen] = useState(false);`, add:

```tsx
const [searchOpen, setSearchOpen] = useState(false);
```

- [ ] **Step 2: Slim top nav on mobile**

Find the row inside the top nav (currently `<div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-x-6">` at `src/routes/__root.tsx:228`). Wrap *only the links section* (everything from `<CategoryDropdown />` through `<UserMenu />` / sign-in button) in `hidden md:flex`. Keep `<LanguageSelector />` outside the wrap so it stays visible on mobile.

Concretely, change:

```tsx
<div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-x-6">
	<CategoryDropdown />
	<Link to="/varusteet" ... >{t("nav.gear")}</Link>
	<Link to="/varaosat" ... >{t("nav.parts")}</Link>
	{verified ? ( ... ) : ( ... )}
	{session ? ( ... ) : ( <button ...>{t("nav.signIn")}</button> )}
	<LanguageSelector />
</div>
```

to:

```tsx
<div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-x-6">
	<div className="hidden flex-wrap items-center gap-x-4 gap-y-2 md:flex md:gap-x-6">
		<CategoryDropdown />
		<Link to="/varusteet" ... >{t("nav.gear")}</Link>
		<Link to="/varaosat" ... >{t("nav.parts")}</Link>
		{verified ? ( ... ) : ( ... )}
		{session ? ( ... ) : ( <button ...>{t("nav.signIn")}</button> )}
	</div>
	<LanguageSelector />
</div>
```

Do not change any of the inner JSX of those elements — only the wrapper and its `hidden md:flex` toggle.

- [ ] **Step 3: Add bottom padding to main**

Change the `<main id="main-content">{children}</main>` line at `src/routes/__root.tsx:311` to:

```tsx
<main id="main-content" className="pb-16 md:pb-0">{children}</main>
```

- [ ] **Step 4: Mount `<BottomNav>` and `<MobileSearchOverlay>`**

Inside the existing `{!isAdmin && ( ... )}` block that currently wraps the footer (around `src/routes/__root.tsx:312`), add the bottom nav and overlay before or alongside the footer. Easiest: add a new sibling `{!isAdmin && ...}` block immediately after the footer's closing brace, before the `<Toaster />` / closing of `<body>`:

```tsx
{!isAdmin && (
	<>
		<BottomNav
			session={session}
			verified={verified}
			onSearchClick={() => setSearchOpen(true)}
			onSignInClick={() => setLoginOpen(true)}
		/>
		<MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
	</>
)}
```

Verify `session` and `verified` are already in scope at this point (they are — both are used above in the existing nav).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Unit tests still pass**

Run: `pnpm test`
Expected: PASS (no behavior changes to tested code).

- [ ] **Step 7: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "feat(nav): wire BottomNav and MobileSearchOverlay into root layout"
```

---

## Task 7: Playwright e2e (mobile viewport)

**Files:**
- Create: `e2e/tests/mobile-bottom-nav.spec.ts`
- Modify: `playwright.config.ts`

Three checks, all signed-out on mobile viewport:

1. Tap Search → overlay opens → type `honda` → submit → URL contains `q=honda`.
2. Tap Add → login modal visible.
3. Tap Bookings → login modal visible.

- [ ] **Step 1: Add the spec to the mobile project**

In `playwright.config.ts` change:

```ts
testMatch: ["**/a11y.spec.ts", "**/listings.spec.ts"],
```

to:

```ts
testMatch: ["**/a11y.spec.ts", "**/listings.spec.ts", "**/mobile-bottom-nav.spec.ts"],
```

- [ ] **Step 2: Write the spec**

Create `e2e/tests/mobile-bottom-nav.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("mobile bottom nav", () => {
	test("search overlay submits query", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-search").click();
		const input = page.getByPlaceholder(/etsi|search/i);
		await expect(input).toBeVisible();
		await input.fill("honda");
		await input.press("Enter");
		await expect(page).toHaveURL(/\/pyorat\/myynti\?.*q=honda/);
	});

	test("add tab opens login modal when signed out", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-add").click();
		await expect(page.getByRole("dialog").filter({ hasText: /kirjaudu|sign in/i })).toBeVisible();
	});

	test("bookings tab opens login modal when signed out", async ({ page }) => {
		await page.goto("/");
		await page.getByTestId("bottom-nav-bookings").click();
		await expect(page.getByRole("dialog").filter({ hasText: /kirjaudu|sign in/i })).toBeVisible();
	});
});
```

NOTE: the existing `LoginModal` likely uses a different role/structure. If the assertion fails, inspect `src/components/auth/login-modal.tsx` and replace the locator with whatever stable hook it exposes (`data-testid`, `role="dialog"`, etc.). Add a `data-testid="login-modal"` to that component if none exists, and update both assertions accordingly. That edit is part of this task if needed.

- [ ] **Step 3: Run only the new spec**

Run: `pnpm test:e2e --project=mobile e2e/tests/mobile-bottom-nav.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/mobile-bottom-nav.spec.ts playwright.config.ts
# include src/components/auth/login-modal.tsx if you added a test id
git commit -m "test(nav): e2e for mobile bottom nav"
```

---

## Task 8: Final verification (batch)

Per user preference, run the full verification suite once at the end.

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 2: Lint + format**

Run: `pnpm lint:fix && pnpm format:fix`
Expected: clean exit. If files were rewritten, review and:

```bash
git add -A
git commit -m "chore: lint and format"
```

- [ ] **Step 3: Unit tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Full e2e**

Run: `pnpm test:e2e`
Expected: PASS. If a pre-existing test breaks because of `pb-16` on main or fixed-position overlap (e.g., a `getByText` click that's now obscured by the bottom bar), fix the e2e or the spacing — root-cause it, don't paper over.

- [ ] **Step 5: Smoke test in browser (manual)**

Start dev server (`pnpm dev`), open `http://localhost:3000` in a mobile viewport (DevTools device toolbar, iPhone 15 or similar). Verify:

- Bottom nav visible; top nav links collapsed to logo + language selector.
- Search opens the overlay; categories navigate and close; city picker navigates and closes; submitting a query goes to `/pyorat/myynti?q=...` and appears in recent searches afterwards.
- Add (signed-out) opens login modal; Bookings (signed-out) opens login modal.
- Resize to desktop: bottom nav hidden, top nav full.
- No layout shift / content cut off behind the bar.

- [ ] **Step 6: Push and open PR**

```bash
git push -u origin feat/mobile-bottom-nav
gh pr create --title "feat(nav): mobile bottom nav" --body "$(cat <<'EOF'
## Summary
- Mobile-only bottom nav (Browse, Search, Add, Bookings, Account)
- Full-screen search overlay with categories, city picker, recent searches
- Top nav slimmed to logo + language selector under md

## Test plan
- [ ] pnpm test
- [ ] pnpm test:e2e (mobile project)
- [ ] Manual: iPhone 15 viewport — every tab + overlay
- [ ] Manual: desktop viewport — bottom nav hidden, top nav intact
EOF
)"
```
