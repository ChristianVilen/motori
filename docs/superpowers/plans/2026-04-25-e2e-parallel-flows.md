# E2E Parallel Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace many short independent e2e tests with a handful of serial user-flow specs, delete debug files, and scope the mobile Playwright project to only the tests that need it.

**Architecture:** Each auth-mutating spec gets `test.describe.configure({ mode: 'serial' })` and a single shared `page` created in `beforeAll`. Tests within each describe chain state naturally; describes in different files still run in parallel. Read-only listing browse tests remain parallel and use the pre-saved `authenticatedPage` fixture rather than the `loginAs()` UI helper. A new `listing-lifecycle.spec.ts` covers the owner CRUD path end-to-end.

**Tech Stack:** Playwright, Kysely (direct DB access from test files for user verification), existing page-object pattern in `e2e/pages/`.

---

## File map

| Action | Path |
|---|---|
| Delete | `e2e/tests/auth-debug.spec.ts` |
| Delete | `e2e/tests/home-test-debug.spec.ts` |
| Delete | `e2e/tests/listings-debug.spec.ts` |
| Delete | `e2e/tests/mobile-debug.spec.ts` |
| Modify | `src/routes/omat/index.tsx` — add test IDs to listing row |
| Modify | `src/components/listings/listing-form.tsx` — add test ID to submit button |
| Create | `e2e/pages/dashboard.page.ts` |
| Create | `e2e/pages/listing-form.page.ts` |
| Rewrite | `e2e/tests/auth.spec.ts` |
| Rewrite | `e2e/tests/listings.spec.ts` |
| Rewrite | `e2e/tests/unverified.spec.ts` |
| Rewrite | `e2e/tests/delete-account.spec.ts` |
| Rewrite | `e2e/tests/email.spec.ts` |
| Create | `e2e/tests/listing-lifecycle.spec.ts` |
| Modify | `playwright.config.ts` |

---

## Task 1: Delete debug spec files

**Files:**
- Delete: `e2e/tests/auth-debug.spec.ts`
- Delete: `e2e/tests/home-test-debug.spec.ts`
- Delete: `e2e/tests/listings-debug.spec.ts`
- Delete: `e2e/tests/mobile-debug.spec.ts`

- [ ] **Step 1: Delete the four debug files**

```bash
rm e2e/tests/auth-debug.spec.ts \
   e2e/tests/home-test-debug.spec.ts \
   e2e/tests/listings-debug.spec.ts \
   e2e/tests/mobile-debug.spec.ts
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "test: delete debug spec files"
```

---

## Task 2: Add test IDs to dashboard listing row

**Files:**
- Modify: `src/routes/omat/index.tsx`

The `ListingRow` component's outer div and action buttons currently have no `data-testid`. The listing-lifecycle spec needs to find rows by listing ID and click edit/delete.

- [ ] **Step 1: Add test IDs to the ListingRow component**

In `src/routes/omat/index.tsx`, find the `return (` inside `ListingRow` and update the outer div and action buttons:

```tsx
// Outer div — was:
<div className="flex gap-4 rounded-xl border border-border bg-card p-4">
// becomes:
<div
  className="flex gap-4 rounded-xl border border-border bg-card p-4"
  data-testid="dashboard-listing-row"
  data-listing-id={listing.id}
>
```

The verified edit `Link` — was:
```tsx
<Link to="/ilmoitukset/$listingId/muokkaa" params={{ listingId: listing.id }}>
  <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
```
becomes:
```tsx
<Link
  to="/ilmoitukset/$listingId/muokkaa"
  params={{ listingId: listing.id }}
  data-testid="dashboard-listing-edit"
>
  <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
```

The delete `Button` — was:
```tsx
<Button
  variant="outline"
  size="sm"
  className="h-7 px-2 text-xs text-destructive hover:border-destructive hover:text-destructive"
  onClick={handleDelete}
  disabled={!verified}
  title={!verified ? tAuth("unverifiedTooltip") : undefined}
>
```
becomes:
```tsx
<Button
  variant="outline"
  size="sm"
  className="h-7 px-2 text-xs text-destructive hover:border-destructive hover:text-destructive"
  onClick={handleDelete}
  disabled={!verified}
  title={!verified ? tAuth("unverifiedTooltip") : undefined}
  data-testid="dashboard-listing-delete"
>
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/omat/index.tsx
git commit -m "test: add data-testid to dashboard listing row, edit link, delete button"
```

---

## Task 3: Add test ID to listing form submit button

**Files:**
- Modify: `src/components/listings/listing-form.tsx`

The submit button has no `data-testid`, making it hard to target precisely from tests.

- [ ] **Step 1: Add data-testid to submit button**

In `src/components/listings/listing-form.tsx`, find the submit button (near line 593):

```tsx
// was:
<button
  type="submit"
  disabled={isSubmitting}
  className="..."
>
// becomes (add data-testid):
<button
  type="submit"
  data-testid="listing-form-submit"
  disabled={isSubmitting}
  className="..."
>
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/listings/listing-form.tsx
git commit -m "test: add data-testid to listing form submit button"
```

---

## Task 4: Create DashboardPage page object

**Files:**
- Create: `e2e/pages/dashboard.page.ts`

- [ ] **Step 1: Create the page object**

```typescript
import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class DashboardPage {
	readonly page: Page;
	readonly newListingButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.newListingButton = page.getByTestId("dashboard-new-listing");
	}

	async goto() {
		await this.page.goto("/omat");
		await waitForHydration(this.page);
	}

	listingRow(listingId: string): Locator {
		return this.page.locator(
			`[data-testid="dashboard-listing-row"][data-listing-id="${listingId}"]`,
		);
	}

	editButton(listingId: string): Locator {
		return this.listingRow(listingId).locator('[data-testid="dashboard-listing-edit"]');
	}

	deleteButton(listingId: string): Locator {
		return this.listingRow(listingId).locator('[data-testid="dashboard-listing-delete"]');
	}
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/dashboard.page.ts
git commit -m "test: add DashboardPage page object"
```

---

## Task 5: Create ListingFormPage page object

**Files:**
- Create: `e2e/pages/listing-form.page.ts`

The listing form uses standard HTML `id` attributes on inputs and a custom button-based dropdown for make selection. There is no `#model-trigger` step needed since model is optional.

- [ ] **Step 1: Create the page object**

```typescript
import type { Locator, Page } from "@playwright/test";
import { waitForHydration } from "../helpers";

export class ListingFormPage {
	readonly page: Page;
	readonly titleInput: Locator;
	readonly makeTrigger: Locator;
	readonly yearInput: Locator;
	readonly motorcycleTypeSelect: Locator;
	readonly pricePerDayInput: Locator;
	readonly cityInput: Locator;
	readonly regionSelect: Locator;
	readonly submitButton: Locator;

	constructor(page: Page) {
		this.page = page;
		this.titleInput = page.locator("#title");
		this.makeTrigger = page.locator("#make-trigger");
		this.yearInput = page.locator("#year");
		this.motorcycleTypeSelect = page.locator("#motorcycle_type");
		this.pricePerDayInput = page.locator("#price_per_day");
		this.cityInput = page.locator("#city");
		this.regionSelect = page.locator("#region");
		this.submitButton = page.getByTestId("listing-form-submit");
	}

	async gotoCreate() {
		await this.page.goto("/ilmoitukset/uusi");
		await this.titleInput.waitFor();
		await waitForHydration(this.page);
	}

	async selectMake(name: string) {
		await this.makeTrigger.click();
		await this.page.getByPlaceholder("Hae...").fill(name);
		await this.page.getByRole("button", { name, exact: true }).click();
	}

	async selectMotorcycleType(label: string) {
		await this.motorcycleTypeSelect.click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async selectRegion(label: string) {
		await this.regionSelect.click();
		await this.page.getByRole("option", { name: label }).click();
	}

	async fill(data: {
		title: string;
		make: string;
		year: number;
		motorcycleType: string;
		pricePerDay: number;
		city: string;
		region: string;
	}) {
		await this.titleInput.fill(data.title);
		await this.selectMake(data.make);
		await this.yearInput.fill(String(data.year));
		await this.selectMotorcycleType(data.motorcycleType);
		await this.pricePerDayInput.fill(String(data.pricePerDay));
		await this.cityInput.fill(data.city);
		await this.selectRegion(data.region);
	}
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/listing-form.page.ts
git commit -m "test: add ListingFormPage page object"
```

---

## Task 6: Rewrite auth.spec.ts as serial flow

**Files:**
- Rewrite: `e2e/tests/auth.spec.ts`

Replace the four independent describes (Login, Register, Navbar, plus implicit password strength test) with two describes:
1. `Auth flow` — serial, shared page; walks registration → logout → wrong creds → correct creds → login modal
2. `Duplicate email` — single parallel test; owns its own accounts

The serial describe shares a single `page` instance and `email`/`password` constants declared at describe scope. Tests chain: after "register" the user is on `/taydenna-profiili`; after "sign out" they're on home unauthenticated; etc.

- [ ] **Step 1: Replace the file**

```typescript
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { HomePage } from "../pages/home.page";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";

test.describe("Auth flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();
	const password = "Password123!";
	const name = uniqueName();

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("login page renders and links to register", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await expect(login.emailInput).toBeVisible();
		await expect(login.passwordInput).toBeVisible();
		await login.registerLink.click();
		await expect(page).toHaveURL(/\/rekisteroidy/);
	});

	test("register form shows password strength indicator", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.passwordInput.pressSequentially("weak", { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Heikko");
		await register.passwordInput.selectText();
		await register.passwordInput.pressSequentially(password, { delay: 30 });
		await expect(register.passwordStrength).toHaveAttribute("data-strength", "Vahva");
	});

	test("register new account redirects to profile completion", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.nameInput.fill(name);
		await register.emailInput.fill(email);
		await register.passwordInput.pressSequentially(password, { delay: 30 });
		await register.submitButton.click();
		await expect(page).toHaveURL(/\/taydenna-profiili/, { timeout: 10000 });
	});

	test("sign out clears the session", async () => {
		const home = new HomePage(page);
		await home.goto();
		await waitForHydration(page);
		await home.navSignOutLink.click();
		await expect(home.navLoginLink).toBeVisible({ timeout: 5000 });
		await expect(home.navDashboardLink).not.toBeVisible();
	});

	test("wrong credentials show login error", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, "wrongpassword");
		await expect(login.errorMessage).toBeVisible();
	});

	test("correct credentials restore the session", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, password);
		const home = new HomePage(page);
		await expect(home.navDashboardLink).toBeVisible({ timeout: 10000 });
	});

	test("login modal from nav works", async () => {
		const home = new HomePage(page);
		await home.goto();
		await waitForHydration(page);
		await home.navSignOutLink.click();
		await expect(home.navLoginLink).toBeVisible({ timeout: 5000 });
		await home.navLoginLink.click();
		await expect(home.loginModal).toBeVisible();
		const modalLogin = new LoginPage(page, home.loginModal);
		await modalLogin.login(email, password);
		await expect(home.loginModal).not.toBeVisible({ timeout: 10000 });
		await expect(home.navDashboardLink).toBeVisible();
	});
});

test.describe("Duplicate email", () => {
	test("register shows error for duplicate email", async ({ page }) => {
		const register = new RegisterPage(page);
		const dupEmail = uniqueEmail();

		await register.goto();
		await register.register(uniqueName(), dupEmail, "Password123!");
		await expect(page).not.toHaveURL(/\/rekisteroidy/, { timeout: 10000 });

		await register.goto();
		await register.register(uniqueName(), dupEmail, "Password123!");
		await expect(register.errorMessage).toBeVisible();
	});
});
```

- [ ] **Step 2: Run the new spec**

```bash
pnpm test:e2e e2e/tests/auth.spec.ts
```
Expected: all tests pass (both projects × all tests).

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/auth.spec.ts
git commit -m "test: rewrite auth.spec.ts as serial flow"
```

---

## Task 7: Rewrite listings.spec.ts (browse only)

**Files:**
- Rewrite: `e2e/tests/listings.spec.ts`

Replace `loginAs()` calls in `beforeEach` with the `authenticatedPage` fixture. That fixture loads the pre-saved auth state from global-setup — no UI login round-trip. The "unauthenticated" test stays as-is.

Import `test` and `expect` from `../fixtures` (which exports the `authenticatedPage` fixture), not from `@playwright/test` directly.

- [ ] **Step 1: Replace the file**

```typescript
import { expect, test } from "../fixtures";
import { SEEDED_LISTING_ID, SEEDED_LISTING_TITLE } from "../global-setup";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingsPage } from "../pages/listings.page";

test.describe("Listings browse", () => {
	test("renders search bar and result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await expect(listings.searchInput).toBeVisible();
		await expect(listings.searchSubmit).toBeVisible();
		await expect(listings.resultCount).toBeVisible();
	});

	test("search updates URL with query", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto();
		await listings.search("Honda");
		await expect(page).toHaveURL(/q=Honda/);
		await expect(listings.resultCount).toBeVisible();
	});

	test("region URL param shows region label in result count", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ region: "uusimaa" });
		await expect(listings.regionLabel).toHaveText("Uusimaa");
	});

	test("empty search shows empty state", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "xyznonexistentmotorcycle12345" });
		await expect(listings.emptyState).toBeVisible();
	});

	test("seeded listing is visible and links to detail page", async ({ page }) => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "CB500F" });
		const seeded = listings.cardById(SEEDED_LISTING_ID);
		await expect(seeded).toBeVisible();
		await expect(seeded).toContainText(SEEDED_LISTING_TITLE);
		await seeded.click();
		await expect(page).toHaveURL(new RegExp(`/ilmoitukset/${SEEDED_LISTING_ID}$`));
	});
});

test.describe("Listing detail", () => {
	test("renders seeded listing details", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID);
		await expect(detail.title).toHaveText(SEEDED_LISTING_TITLE);
		await expect(detail.priceInfo).toBeVisible();
		await expect(detail.pricePerDay).toContainText("55,00 €");
		await expect(detail.locationInfo).toContainText("Helsinki");
	});

	test("contact reveal exposes the owner contact block", async ({ authenticatedPage }) => {
		const detail = new ListingDetailPage(authenticatedPage);
		await detail.goto(SEEDED_LISTING_ID);
		await expect(detail.ownerContact).toBeHidden();
		await detail.revealOwnerContact();
		await expect(detail.ownerContact).toBeVisible();
	});

	test("shows 404 for nonexistent listing", async ({ page }) => {
		const detail = new ListingDetailPage(page);
		await detail.goto("nonexistent-id-00000000");
		await expect(detail.notFound).toBeVisible();
	});
});

test.describe("Listing detail (unauthenticated)", () => {
	test("new listing page redirects unauthenticated users to login", async ({ page }) => {
		await page.goto("/ilmoitukset/uusi");
		await expect(page).toHaveURL(/\/kirjaudu/);
	});
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm test:e2e e2e/tests/listings.spec.ts
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/listings.spec.ts
git commit -m "test: rewrite listings.spec.ts — use authenticatedPage fixture, drop loginAs"
```

---

## Task 8: Rewrite unverified.spec.ts as serial flow

**Files:**
- Rewrite: `e2e/tests/unverified.spec.ts`

Replace the `beforeAll + loginAs-per-test` pattern with a serial shared page. After registration, the shared `page` is already logged in as the fresh unverified user — no further `loginAs` calls needed.

- [ ] **Step 1: Replace the file**

```typescript
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { TEST_PASSWORD } from "../global-setup";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { RegisterPage } from "../pages/register.page";

test.describe("Unverified user flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("register creates an unverified account", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, TEST_PASSWORD);
		await page.waitForURL(/\/taydenna-profiili/, { timeout: 10000 });
		await waitForHydration(page);
	});

	test("nav add-listing link is disabled for unverified user", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const navAddListing = page.getByTestId("nav-add-listing");
		await expect(navAddListing).toBeVisible();
		const tag = await navAddListing.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("home page CTA is disabled for unverified user", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const cta = page.getByTestId("home-add-listing-cta");
		await expect(cta).toBeVisible();
		const tag = await cta.evaluate((el) => el.tagName.toLowerCase());
		expect(tag).toBe("span");
	});

	test("dashboard new-listing button is disabled", async () => {
		await page.goto("/omat");
		await waitForHydration(page);
		const btn = page.getByTestId("dashboard-new-listing");
		await expect(btn).toBeVisible();
		await expect(btn).toBeDisabled();
	});

	test("direct navigation to /ilmoitukset/uusi is blocked", async () => {
		await page.goto("/ilmoitukset/uusi");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/ilmoitukset\/uusi/);
	});

	test("verification banner shows check-spam prompt then resend button", async () => {
		await page.goto("/");
		await waitForHydration(page);
		await page.getByTestId("nav-dashboard").waitFor();
		const banner = page.locator("text=Vahvista sähköpostiosoitteesi");
		await expect(banner).toBeVisible();
		const resendButton = page.locator("text=Lähetä uudelleen");
		await expect(resendButton).not.toBeVisible();
		const checkSpam = page.locator("text=Tarkista roskaposti");
		await expect(checkSpam).toBeVisible();
		await checkSpam.click();
		await expect(resendButton).toBeVisible();
	});

	test("unverified user can still browse listings", async () => {
		await page.goto("/ilmoitukset");
		await waitForHydration(page);
		await expect(page).toHaveURL(/\/ilmoitukset/);
	});
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm test:e2e e2e/tests/unverified.spec.ts
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/unverified.spec.ts
git commit -m "test: rewrite unverified.spec.ts as serial shared-page flow"
```

---

## Task 9: Rewrite delete-account.spec.ts as serial flow

**Files:**
- Rewrite: `e2e/tests/delete-account.spec.ts`

Replace three independent tests (each registering a fresh user) with a single serial describe that registers once and chains: trigger → validate → cancel → re-trigger → type POISTA → delete → confirm login fails.

- [ ] **Step 1: Replace the file**

```typescript
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";
import { SettingsPage } from "../pages/settings.page";

test.describe("Delete account flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	const email = uniqueEmail();
	const password = "Password123!";

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("register fresh account", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, password);
		await page.waitForURL(/\/taydenna-profiili/, { timeout: 10000 });
		await waitForHydration(page);
	});

	test("navigate to settings and open delete dialog", async () => {
		const settings = new SettingsPage(page);
		await settings.goto();
		await settings.deleteTrigger.click();
		await expect(settings.confirmInput).toBeVisible();
		await expect(settings.deleteSubmit).toBeDisabled();
	});

	test("submit stays disabled until POISTA is typed correctly", async () => {
		const settings = new SettingsPage(page);
		await settings.confirmInput.fill("wrong");
		await expect(settings.deleteSubmit).toBeDisabled();
		await settings.confirmInput.fill("POISTA");
		await expect(settings.deleteSubmit).toBeEnabled();
	});

	test("cancel hides the confirmation form", async () => {
		const settings = new SettingsPage(page);
		await settings.deleteCancel.click();
		await expect(settings.confirmInput).not.toBeVisible();
		await expect(settings.deleteTrigger).toBeVisible();
	});

	test("confirming deletion redirects to homepage", async () => {
		const settings = new SettingsPage(page);
		await settings.deleteTrigger.click();
		await settings.confirmInput.fill("POISTA");
		await settings.deleteSubmit.click();
		await expect(page).toHaveURL("/", { timeout: 10000 });
		await waitForHydration(page);
	});

	test("deleted account cannot log in", async () => {
		const login = new LoginPage(page);
		await login.goto();
		await login.login(email, password);
		await expect(login.errorMessage).toBeVisible();
	});
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm test:e2e e2e/tests/delete-account.spec.ts
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/delete-account.spec.ts
git commit -m "test: rewrite delete-account.spec.ts as serial flow"
```

---

## Task 10: Rewrite email.spec.ts as serial flow

**Files:**
- Rewrite: `e2e/tests/email.spec.ts`

Consolidate six independent describes into one serial flow. Tests chain naturally through the password-reset pages.

- [ ] **Step 1: Replace the file**

```typescript
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { ForgotPasswordPage } from "../pages/forgot-password.page";
import { LoginPage } from "../pages/login.page";
import { ResetPasswordPage } from "../pages/reset-password.page";

test.describe("Password reset flow", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("login page has forgot-password link", async () => {
		const login = new LoginPage(page);
		await login.goto();
		const forgotLink = page.locator("a[href='/unohdin-salasanan']");
		await expect(forgotLink).toBeVisible();
		await forgotLink.click();
		await expect(page).toHaveURL(/\/unohdin-salasanan/);
	});

	test("forgot password form renders", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();
		await expect(forgot.emailInput).toBeVisible();
		await expect(forgot.submitButton).toBeVisible();
	});

	test("submitting email shows success message and hides form", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.requestReset("someone@example.com");
		await expect(forgot.successMessage).toBeVisible();
		await expect(forgot.form).not.toBeVisible();
	});

	test("back-to-login link navigates to login", async () => {
		const forgot = new ForgotPasswordPage(page);
		await forgot.goto();
		await forgot.backToLoginLink.first().click();
		await expect(page).toHaveURL(/\/kirjaudu/);
	});

	test("reset form disabled without token", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto();
		await expect(reset.submitButton).toBeDisabled();
	});

	test("reset form renders and enables submit with token", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ token: "test-token" });
		await expect(reset.passwordInput).toBeVisible();
		await expect(reset.confirmInput).toBeVisible();
		await expect(reset.submitButton).toBeEnabled();
	});

	test("mismatched passwords show error", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.resetPassword("NewPassword1!", "DifferentPassword1!");
		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("eivät täsmää");
	});

	test("invalid token error param shows expired message", async () => {
		const reset = new ResetPasswordPage(page);
		await reset.goto({ error: "INVALID_TOKEN" });
		await expect(reset.errorMessage).toBeVisible();
		await expect(reset.errorMessage).toContainText("vanhentunut");
	});
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm test:e2e e2e/tests/email.spec.ts
```
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/email.spec.ts
git commit -m "test: rewrite email.spec.ts as serial password-reset flow"
```

---

## Task 11: Create listing-lifecycle.spec.ts

**Files:**
- Create: `e2e/tests/listing-lifecycle.spec.ts`

Full owner CRUD flow: register → verify via direct DB update → create listing → assert in browse → edit title → delete. The make "Honda" is safe to use because `global-setup.ts` seeds a `motorcycle_make` row with `name: "Honda"` (slug `honda-e2e`) before every run, so it exists even in CI where `pnpm db:seed` is not run.

After registering via UI, `emailVerified` is `false` (the server has `DISABLE_EMAIL_VERIFICATION=true` which allows sign-in but does not auto-verify). The test must flip the flag directly in the DB and reload so the session re-reads the updated user. This is the same pattern used in `global-setup.ts` (which also imports the DB from a test-runner Node.js process).

- [ ] **Step 1: Create the file**

```typescript
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueName, waitForHydration } from "../helpers";
import { DashboardPage } from "../pages/dashboard.page";
import { ListingFormPage } from "../pages/listing-form.page";
import { ListingDetailPage } from "../pages/listing-detail.page";
import { ListingsPage } from "../pages/listings.page";
import { RegisterPage } from "../pages/register.page";

const LISTING_TITLE = "E2E Lifecycle Yamaha MT-07 2021";
const LISTING_TITLE_EDITED = "E2E Lifecycle Yamaha MT-07 2021 – muokattu";

test.describe("Listing lifecycle", () => {
	test.describe.configure({ mode: "serial" });

	let page: Page;
	let listingId: string;
	const email = uniqueEmail();
	const password = "Password123!";

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});
	test.afterAll(async () => {
		await page.close();
	});

	test("register and verify account", async () => {
		const register = new RegisterPage(page);
		await register.goto();
		await register.register(uniqueName(), email, password);
		await page.waitForURL(/\/taydenna-profiili/, { timeout: 10000 });
		await waitForHydration(page);

		// DISABLE_EMAIL_VERIFICATION=true allows sign-in but does not set emailVerified.
		// Flip the flag directly so the user can create listings.
		const { db } = await import("../../src/lib/db/index");
		await db
			.updateTable("user")
			.set({ emailVerified: true, updatedAt: new Date() })
			.where("email", "=", email)
			.execute();

		// Reload so the server session re-reads emailVerified from DB.
		await page.reload();
		await waitForHydration(page);
	});

	test("create listing and assert detail page", async () => {
		const form = new ListingFormPage(page);
		await form.gotoCreate();
		await form.fill({
			title: LISTING_TITLE,
			make: "Honda",
			year: 2021,
			motorcycleType: "Naked",
			pricePerDay: 45,
			city: "Helsinki",
			region: "Uusimaa",
		});
		await form.submitButton.click();
		await page.waitForURL(/\/ilmoitukset\/[^/]+$/, { timeout: 15000 });

		const match = page.url().match(/\/ilmoitukset\/([^/]+)$/);
		if (!match) throw new Error("Could not extract listing ID from URL");
		listingId = match[1];

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(LISTING_TITLE);
	});

	test("listing appears in browse results", async () => {
		const listings = new ListingsPage(page);
		await listings.goto({ q: "E2E Lifecycle Yamaha" });
		await expect(listings.cardById(listingId)).toBeVisible({ timeout: 10000 });
	});

	test("edit listing updates title", async () => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.listingRow(listingId)).toBeVisible();
		await dashboard.editButton(listingId).click();
		await page.waitForURL(/\/muokkaa/, { timeout: 10000 });
		await waitForHydration(page);

		const form = new ListingFormPage(page);
		await form.titleInput.fill(LISTING_TITLE_EDITED);
		await form.submitButton.click();
		await page.waitForURL(/\/ilmoitukset\/[^/]+$/, { timeout: 15000 });

		const detail = new ListingDetailPage(page);
		await expect(detail.title).toHaveText(LISTING_TITLE_EDITED);
	});

	test("delete listing removes it from dashboard", async () => {
		const dashboard = new DashboardPage(page);
		await dashboard.goto();
		await expect(dashboard.listingRow(listingId)).toBeVisible();

		page.once("dialog", (dialog) => dialog.accept());
		await dashboard.deleteButton(listingId).click();

		await expect(dashboard.listingRow(listingId)).not.toBeVisible({ timeout: 10000 });
	});
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm test:e2e e2e/tests/listing-lifecycle.spec.ts
```
Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/listing-lifecycle.spec.ts
git commit -m "test: add listing-lifecycle serial flow (create, browse, edit, delete)"
```

---

## Task 12: Update playwright.config.ts

**Files:**
- Modify: `playwright.config.ts`

Scope the mobile project to only `a11y.spec.ts` and `listings.spec.ts` — the specs where viewport matters. All other flows run chromium-only, halving CI time for the serial flows.

- [ ] **Step 1: Update the projects array**

```typescript
projects: [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "mobile",
    use: { ...devices["iPhone 15"] },
    testMatch: ["**/a11y.spec.ts", "**/listings.spec.ts"],
  },
],
```

- [ ] **Step 2: Run the full suite**

```bash
pnpm test:e2e
```
Expected: all tests pass across both projects with no flakiness.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "test: scope mobile project to a11y and listings browse specs"
```
