# Resend email integration + issues #3, #4, #13

Date: 2026-04-23

Covers three GitHub issues that all depend on having a real email provider:

- **#3** Parallel email verification (non-blocking registration)
- **#4** Password reset flow
- **#13** Email notifications — listing expiry only (new review deferred to #7, new message not built yet)

## Current state

`src/lib/email.ts` has a `sendEmail()` function with Resend integration commented out. When there's no API key it falls back to `logMockEmail()`, which logs the recipient hash, subject, and any URLs found in the HTML body. This mock fallback stays for local dev.

`src/lib/auth.ts` uses better-auth with `requireEmailVerification: true`, which blocks login until the user clicks the verification link. Registration redirects to `/vahvista-sahkoposti` (a static "check your inbox" page).

`src/lib/notifications.ts` already sends listing expiry warning emails 7 days before the 90-day expiry. It works, just goes through the mock logger.

Finnish email templates exist in `src/lib/i18n/resources/fi/email.ts` for verification and listing expiry.

## 1. Resend integration (foundation)

Install `resend` package. Uncomment the Resend block in `src/lib/email.ts`. Keep the mock fallback when `RESEND_API_KEY` is absent — this is the local dev story. No MSW, no extra dependencies. The mock logger already extracts clickable URLs from the email HTML, so you can grab verification/reset links from the terminal.

Improve the mock log formatting so email links don't get buried in other server output. A clear visual separator around the mock email log.

Add startup validation in `src/start.ts`: if `NODE_ENV=production` and `RESEND_API_KEY` is missing, log a warning. In dev, just log that emails will be mocked.

## 2. Issue #3 — parallel email verification

The idea: let users in immediately after registration. Email verification runs in the background. If they haven't verified within 24 hours, block write actions (create listing, edit listing, contact owner) but still allow browsing and searching.

Changes:

- Set `requireEmailVerification: false` in better-auth config
- Registration flow: sign up -> auto-sign-in -> redirect to `/taydenna-profiili` (profile completion). Verification email still sent in background. No more redirect to `/vahvista-sahkoposti` after registration.
- `/vahvista-sahkoposti` stays as the landing page for when users click the email link.
- Server middleware on write-action API routes: check `user.emailVerified` and `user.createdAt`. If not verified and account is older than 24h, return 403 with an error code.
- Global sticky banner in the root layout for unverified users. Shows on all pages until they verify. Includes a "resend verification email" link.

## 3. Issue #4 — password reset

Use better-auth's built-in `forgetPassword` flow. It handles token generation, storage, and validation. We just need to:

- Add `sendResetPassword` email callback in the auth config (same pattern as the existing `sendVerificationEmail`)
- Add Finnish i18n keys for the reset email template
- Create `/unohdin-salasanan` route — email input form, calls `authClient.forgetPassword()`
- Create `/vaihda-salasana` route — reads token from URL search params, new password + confirm form, calls `authClient.resetPassword()`
- Add "Unohditko salasanan?" (forgot password) link to the login page and login modal

## 4. Issue #13 — listing expiry via Resend

No code changes beyond step 1. `sendListingExpiryWarnings()` already works correctly. Once Resend is active behind `sendEmail()`, the expiry emails go out for real. The `notify:expiry` npm script triggers it.

New review notification is deferred — added a comment to issue #7 to include it when the reviews feature is built.

## Decisions made

| Question | Decision | Reason |
|----------|----------|--------|
| API key management | `.env` + startup validation | Warn in prod if missing, log mock mode in dev |
| Local dev email | Mock fallback with improved log formatting | Simpler than MSW, URLs already extracted |
| Verification enforcement | Block writes only after 24h | Users can browse freely, reduces friction |
| Verification UI | Global sticky banner | Visible on all pages, not just on blocked actions |
| Password reset | better-auth built-in flow | Already handles tokens, no custom implementation needed |
| New review email | Deferred to issue #7 | Reviews feature doesn't exist yet |
| New message email | Skipped | Messaging feature doesn't exist yet |

## Implementation order

1. Install `resend`, activate in `email.ts` with mock fallback + better log formatting
2. Startup validation in `start.ts`
3. Issue #3: flip `requireEmailVerification`, update registration redirect, add middleware, add banner
4. Issue #4: enable `forgetPassword`, add email template, create two routes, add links
5. Lint + typecheck
