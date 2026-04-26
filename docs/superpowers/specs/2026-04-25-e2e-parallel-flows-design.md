# E2E Test Parallelisation & Flow Redesign

**Date:** 2026-04-25

## Problem

The current e2e suite has become flaky under `fullyParallel: true` because:

1. Four debug spec files (`auth-debug`, `home-test-debug`, `listings-debug`, `mobile-debug`) are picked up as real tests — they screenshot, `waitForTimeout`, and `console.log`.
2. Auth-mutating tests (register, login, delete) run concurrently, producing race conditions and DB collisions.
3. `loginAs()` drives the full login UI in `beforeEach`, creating many concurrent sessions for the same account.
4. `unverified.spec.ts` registers once in `beforeAll` then all five tests call `loginAs()` in parallel — race-prone.
5. Many small isolated tests repeat expensive setup (page load, login) for each assertion.

## Design

### Files to delete

- `e2e/tests/auth-debug.spec.ts`
- `e2e/tests/home-test-debug.spec.ts`
- `e2e/tests/listings-debug.spec.ts`
- `e2e/tests/mobile-debug.spec.ts`

### Serial flow pattern

Auth-mutating spec files use a shared `page` across all tests in the describe, with `mode: 'serial'`. Tests chain state naturally — no repeated setup for each assertion.

```ts
test.describe.configure({ mode: 'serial' });

test.describe("Flow name", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(() => page.close());

  test("step one", async () => { /* ... */ });
  test("step two", async () => { /* state flows from step one */ });
});
```

Files run in parallel with each other; steps within a file run sequentially.

### Flow files

**`auth.spec.ts`** — serial, shared page

Journey: register → duplicate email error → logout → login with wrong credentials → login with correct credentials → login via nav modal

Each step is a named test that asserts one outcome. State flows: after "register" the user is logged in; "logout" leaves them logged out; "login correct" restores the session.

**`listing-lifecycle.spec.ts`** — serial, shared page

Journey: register fresh user → create listing via form → assert listing appears in browse results → edit listing → assert change persists → delete listing → assert gone from browse

Uses `uniqueEmail()` for a fresh account so it is fully independent of the global-setup test user. Exercises the full owner CRUD path.

**`listings-browse.spec.ts`** — parallel-friendly (read-only)

Tests: search by keyword → region filter → view seeded listing detail → contact reveal (uses `authenticatedPage` fixture) → 404 for nonexistent listing → unauthenticated redirect for `/ilmoitukset/uusi`

These tests only read from the DB and use the pre-saved auth state from `global-setup` via the `authenticatedPage` fixture — no UI login.

**`unverified.spec.ts`** — serial, shared page

Journey: register fresh user → nav add-listing is a `<span>` (disabled) → home CTA is a `<span>` → dashboard new-listing button disabled → verification banner shows check-spam prompt then resend → browse listings still works

**`delete-account.spec.ts`** — serial, shared page

Journey: register fresh user → open delete dialog → submit disabled without "POISTA" → cancel hides dialog → open again → type "POISTA" → submit → assert redirected / logged out

**`email.spec.ts`** — serial, shared page

Journey: forgot password form renders → submit email → success message shown, form hidden → back-to-login link → reset password form renders with token param

**`a11y.spec.ts`** — parallel, keep as-is

Read-only axe scans across static pages. No change needed.

### Playwright config change

Remove the `mobile` project from the default project list. It doubles CI time for flows where viewport is irrelevant. Re-add it only for `a11y.spec.ts` and `listings-browse.spec.ts` using per-project `testMatch`.

```ts
projects: [
  {
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "mobile",
    use: { ...devices["iPhone 15"] },
    testMatch: ["**/a11y.spec.ts", "**/listings-browse.spec.ts"],
  },
],
```

### `fixtures.ts` and `helpers.ts`

`authenticatedPage` fixture stays — used by `listings-browse.spec.ts` for the contact-reveal test. `loginAs()` helper stays for `unverified.spec.ts` (needs a fresh registered user, not the global test user).

### Global setup

No changes needed. Still seeds the shared test user and `SEEDED_LISTING_ID` listing used by `listings-browse.spec.ts`.

## Success criteria

- Zero flaky tests across 5 consecutive local runs with `fullyParallel: true`
- CI wall time reduced (fewer redundant UI logins, mobile project scoped down)
- No debug files in test output
- Each flow file reads as a coherent user story from top to bottom
