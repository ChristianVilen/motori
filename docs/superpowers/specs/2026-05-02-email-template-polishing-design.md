# Email template polishing — design spec

**Date:** 2026-05-02
**Branch:** email-template-polishing
**Issue:** #59 — Improve email feature so that emails do not go to junk

## Problem

All 7 transactional emails are rendered as bare `<p>` tags with no styling, no HTML
doctype, and no table-based layout. This makes them look unprofessional and increases
the chance of landing in junk. Emails are hardcoded to Finnish regardless of the
recipient's stored language preference.

## Scope

7 email types:

1. Email verification (`auth.ts`)
2. Password reset (`auth.ts`)
3. Booking request — sent to owner (`booking-emails.ts`)
4. Booking confirmed — sent to renter (`booking-emails.ts`)
5. Booking rejected — sent to renter (`booking-emails.ts`)
6. Booking auto-rejected — sent to renter (`booking-emails.ts`)
7. Listing expiry warning — sent to owner (`notifications.ts`)

## Architecture

### Shared HTML wrapper

One MJML layout file is compiled once to a production-ready HTML string. A TypeScript
helper, `wrapEmail(content: string): string`, replaces a `{{content}}` placeholder with
the passed-in HTML and returns the full email. All 7 send functions call `wrapEmail`.

```
src/lib/email-templates/
  layout.mjml       # MJML 4.x source — design source of truth
  layout.html       # compiled output committed for reference (not imported at runtime)
src/lib/email-wrapper.ts   # exports wrapEmail(content: string): string
```

`layout.html` is compiled with:
```bash
npx mjml src/lib/email-templates/layout.mjml \
  -o src/lib/email-templates/layout.html \
  --config.minify=true \
  --config.validationLevel=strict
```

`email-wrapper.ts` inlines the compiled HTML as a string constant (no file read at
runtime). The `{{content}}` slot accepts plain HTML — `<p>`, `<strong>`, `<a>` — which
is sufficient for these transactional emails.

The content slot is declared in `layout.mjml` as `<mj-raw>{{content}}</mj-raw>` inside
the body section. MJML's `<mj-raw>` passes its contents through the compiler unchanged,
so `{{content}}` survives compilation into `layout.html`. `wrapEmail` does a simple
`template.replace("{{content}}", content)`.

### Visual design

- **Header:** dark navy (`#1a1a2e`) band, "Motori" in white Manrope bold, small orange
  (`#e07a3a`) underline accent
- **Body:** white card on `#fafaf9` background, 16px Manrope, `#1a1a2e` text, 32px
  padding
- **CTA buttons / primary links:** orange `#ad5016` fill, white text, 6px border-radius
- **Footer:** light muted band (`#f0efed`), `motori.fi` text link, "Motori" sign-off
- **Max width:** 600px
- **Font stack:** Manrope (loaded via `<mj-font>`), Arial, sans-serif fallback

### Internationalisation

`src/lib/i18n/email.ts` currently exports a fixed Finnish `emailT`. Replace with a
parameterised factory:

```ts
export function getEmailT(lang: "fi" | "en") {
  return createI18nSync(lang).getFixedT(lang, "email");
}
```

Language resolution per email type:

| Email type | How language is resolved |
|---|---|
| Verification | Extra `db.selectFrom("profile").where("user_id", user.id)` in the BetterAuth callback. Fire-and-forget — does not block BetterAuth. |
| Password reset | Same as verification. |
| Booking emails | `PartyInfo` gains `language: "fi" \| "en"`. Callers add `profile.language` to their existing profile select and pass it in. |
| Listing expiry | `sendListingExpiryWarnings` already joins `profile`; add `profile.language` to the select and use it per-row. |

### English copy

Add all missing keys to `src/lib/i18n/resources/en/email.ts`:
- `bookingRequest` (subject, greeting, intro, dates, renter, message, cta)
- `bookingConfirmed` (subject, greeting, body, ownerContact, nextSteps)
- `bookingRejected` (subject, greeting, body, reasonLabel, fallback)
- `bookingAutoRejected` (subject, greeting, body, fallback)
- `listingExpiry` (subject, greeting, body, cta) — keys exist but verify completeness

Run all English and Finnish copy through the humanizer skill to remove AI-writing
patterns before committing.

## What is NOT in scope

- Per-user language preference UI (already stored in `profile.language`; just not used)
- Review notification email (deferred, tracked separately)
- MJML as a build-time pipeline step — MJML is a design tool only; compiled HTML is
  committed and inlined as a string constant

## Files changed

| File | Change |
|---|---|
| `src/lib/email-templates/layout.mjml` | New — MJML source |
| `src/lib/email-templates/layout.html` | New — compiled output |
| `src/lib/email-wrapper.ts` | New — `wrapEmail()` helper |
| `src/lib/i18n/email.ts` | Replace fixed `emailT` export with `getEmailT(lang)` factory |
| `src/lib/i18n/resources/en/email.ts` | Add missing booking + listingExpiry keys, humanize all copy |
| `src/lib/i18n/resources/fi/email.ts` | Humanize copy |
| `src/lib/auth.ts` | Use `wrapEmail`, fetch profile language for both email types |
| `src/lib/booking-emails.ts` | Use `wrapEmail`, add `language` to `PartyInfo`, use `getEmailT` |
| `src/lib/notifications.ts` | Use `wrapEmail`, add `profile.language` to select, use `getEmailT` |
