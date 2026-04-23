# Resend email integration + issues #3, #4, #13

Date: 2026-04-23

Covers three GitHub issues that all depend on having a real email provider:

- **#3** Parallel email verification (non-blocking registration)
- **#4** Password reset flow
- **#13** Email notifications — listing expiry only (new review deferred to #7, new message not built yet)

## Current state (before this branch)

`src/lib/email.ts` has a `sendEmail()` function with Resend integration commented out. When there's no API key it falls back to `logMockEmail()`, which logs the recipient hash, subject, and any URLs found in the HTML body. This mock fallback stays for local dev.

`src/lib/auth.ts` uses better-auth with `requireEmailVerification: true`, which blocks login until the user clicks the verification link. Registration redirects to `/vahvista-sahkoposti` (a static "check your inbox" page).

`src/lib/notifications.ts` already sends listing expiry warning emails 7 days before the 90-day expiry. It works, just goes through the mock logger.

Finnish email templates exist in `src/lib/i18n/resources/fi/email.ts` for verification and listing expiry.

## 1. Resend integration (foundation)

Installed `resend` (pinned to `6.12.2`). Activated in `src/lib/email.ts` with mock fallback when `RESEND_API_KEY` is absent. The mock logger extracts clickable URLs from the email HTML with a clear visual box separator so links don't get buried in server output.

Key implementation details:
- **Dynamic import**: `Resend` is loaded via `await import("resend")` inside an async `getResend()` to prevent the SDK from leaking into the client bundle. The instance is cached after first init.
- **FROM address**: `Vuokramoto <noreply@vuokramoto.fi>` — the verified domain sender.
- **Error propagation**: `sendEmail()` throws on Resend API errors (after logging via `EVENTS.email.failed`). Callers that fire-and-forget use `.catch(() => {})` to avoid unhandled rejections while still getting log visibility.
- **Idempotency**: `EmailPayload` supports an optional `idempotencyKey` field, used by listing expiry warnings to prevent duplicate sends.

Startup validation was considered but removed — the lazy init pattern makes it unnecessary. The mock fallback handles the missing key case gracefully.

## 2. Issue #3 — parallel email verification

Users are let in immediately after registration. Email verification runs in the background. Unverified users are blocked from write actions (create listing, edit listing, change listing status) but can still browse and search.

Changes:
- `requireEmailVerification: false` in better-auth config
- Registration flow: sign up → auto-sign-in → redirect to `/taydenna-profiili` (profile completion). Verification email sent in background (fire-and-forget with `.catch()`). No more redirect to `/vahvista-sahkoposti`.
- Server middleware `requireVerifiedEmail()` on write-action server functions: checks `user.emailVerified`. If not verified, returns 403 with `EMAIL_NOT_VERIFIED`. Applied to: create listing, update listing, set listing status, image upload.
- Client-side enforcement via `useEmailVerified()` hook (returns `boolean | null` — `null` during SSR/hydration to avoid flash). Disables "add listing" nav link, home page CTA, dashboard buttons, and empty-state links for unverified users. Disabled elements show a tooltip explaining why.
- Global sticky banner in root layout for unverified users. Two-step UX: first shows "check spam" prompt, then reveals "resend verification email" button. Includes error handling and prevents double-clicks.

## 3. Issue #4 — password reset

Uses better-auth's built-in password reset flow (token generation, storage, validation handled by the library).

Implementation:
- `sendResetPassword` callback in auth config — fire-and-forget email with `.catch()`, same pattern as verification email
- Finnish i18n keys for reset email template in `src/lib/i18n/resources/fi/email.ts`
- `/unohdin-salasanan` route — email input form, calls `authClient.requestPasswordReset()`. Wrapped in try/catch; always shows success message regardless of outcome (prevents email enumeration).
- `/vaihda-salasana` route — reads `token` and `error` from URL search params. New password + confirm form with password strength indicator (same logic as registration page). Submit disabled when password is weak (score ≤ 1) or no token present. URL error param handled via `useEffect` to avoid stale state on re-navigation.
- "Unohditko salasanan?" link added to login form (`login-form.tsx`)

## 4. Issue #13 — listing expiry via Resend

No code changes beyond step 1. `sendListingExpiryWarnings()` already works correctly. Once Resend is active behind `sendEmail()`, the expiry emails go out for real. The `notify:expiry` npm script triggers it. Added `idempotencyKey` (`expiry-warning/${listingId}`) to prevent duplicate sends.

New review notification is deferred — added a comment to issue #7 to include it when the reviews feature is built.

## Decisions made

| Question | Decision | Reason |
|----------|----------|--------|
| API key management | `.env` only, no startup validation | Lazy init handles missing key; mock fallback is the dev story |
| Local dev email | Mock fallback with box-formatted log | Simpler than MSW, URLs already extracted |
| Resend import | Dynamic `await import()` | Prevents SDK from leaking into client bundle |
| Email errors | Throw from `sendEmail()`, callers `.catch()` | Errors are logged + visible; fire-and-forget callers don't crash |
| Verification enforcement | Block writes immediately (no grace period) | Simpler; users can browse freely, banner prompts verification |
| Verification UI | Global sticky banner with check-spam → resend two-step | Reduces unnecessary resend requests |
| useEmailVerified | Returns `boolean \| null` | `null` during SSR/hydration prevents flash of enabled → disabled |
| Password reset | better-auth built-in flow | Already handles tokens, no custom implementation needed |
| Password strength | Reused register page logic on reset page | Consistent UX, blocks weak passwords |
| Resend version | Pinned to `6.12.2` (no caret) | Matches project convention for dependency pinning |
| New review email | Deferred to issue #7 | Reviews feature doesn't exist yet |
| New message email | Skipped | Messaging feature doesn't exist yet |

## Files changed

### New files
- `src/routes/unohdin-salasanan.tsx` — forgot password page
- `src/routes/vaihda-salasana.tsx` — reset password page
- `src/lib/require-verified-email.ts` — server middleware for write-action gating
- `src/lib/use-email-verified.ts` — client hook for UI gating
- `e2e/pages/forgot-password.page.ts` — page object
- `e2e/pages/reset-password.page.ts` — page object
- `e2e/tests/email.spec.ts` — forgot/reset password + verification banner e2e tests
- `e2e/tests/unverified.spec.ts` — unverified user restriction e2e tests

### Modified files
- `src/lib/email.ts` — Resend integration with dynamic import, error propagation
- `src/lib/auth.ts` — `requireEmailVerification: false`, `sendResetPassword` callback, `.catch()` on fire-and-forget emails
- `src/routes/__root.tsx` — verification banner, disabled nav link for unverified users
- `src/routes/index.tsx` — disabled CTA and footer link for unverified users
- `src/routes/omat/index.tsx` — disabled dashboard buttons for unverified users
- `src/routes/rekisteroidy.tsx` — redirect to `/taydenna-profiili` instead of `/vahvista-sahkoposti`
- `src/components/auth/login-form.tsx` — forgot password link
- `src/components/listings/empty-state.tsx` — disabled link for unverified users
- `src/lib/storage.ts` — `requireVerifiedEmail()` middleware on image upload
- `src/routes/ilmoitukset/uusi.tsx` — `requireVerifiedEmail()` middleware on create listing
- `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` — `requireVerifiedEmail()` middleware on update listing
- `src/lib/notifications.ts` — idempotency key on expiry warning emails
- `src/lib/i18n/resources/fi/auth.ts` — forgot password, reset password, verification banner, tooltip i18n keys
- `src/lib/i18n/resources/fi/email.ts` — password reset email template keys
- `src/lib/security-headers.ts` — `unsafe-eval` in dev CSP for Zod
- `e2e/pages/login.page.ts` — scoped locators for modal login
- `e2e/tests/auth.spec.ts` — updated modal login test
- `package.json` — `resend` dependency (pinned `6.12.2`)
