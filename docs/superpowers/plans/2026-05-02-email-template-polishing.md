# Email Template Polishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bare `<p>` tag emails with branded, cross-client HTML templates; add per-user language (fi/en) to all 7 transactional emails.

**Architecture:** One MJML layout compiled to HTML and inlined as a string constant in `email-wrapper.ts`. A `wrapEmail(content)` helper slots per-email HTML into a `{{content}}` placeholder. The fixed `emailT` export in `i18n/email.ts` is replaced with a `getEmailT(lang)` factory; all send functions resolve the recipient's language from `profile.language` before calling it.

**Tech Stack:** MJML 4.x (via `npx mjml`, not installed permanently), Vitest, Kysely, i18next, TypeScript, TanStack Start SSR

---

## File Map

| File | Action |
|---|---|
| `src/lib/email-templates/layout.mjml` | Create — MJML source (design source of truth) |
| `src/lib/email-templates/layout.html` | Create — compiled output committed for reference |
| `src/lib/email-wrapper.ts` | Create — `wrapEmail(content: string): string` |
| `src/lib/email-wrapper.test.ts` | Create — unit tests for `wrapEmail` |
| `src/lib/i18n/email.ts` | Modify — replace fixed `emailT` with `getEmailT(lang)` factory |
| `src/lib/i18n/email.test.ts` | Create — unit tests for `getEmailT` |
| `src/lib/i18n/resources/en/email.ts` | Modify — add all missing booking + listingExpiry keys |
| `src/lib/i18n/resources/fi/email.ts` | Modify — humanize copy, remove signature key |
| `src/lib/auth.ts` | Modify — fetch profile language, use `wrapEmail` + `getEmailT` |
| `src/lib/booking-emails.ts` | Modify — add `language` to `PartyInfo`, use `wrapEmail` + `getEmailT`, remove signature from HTML |
| `src/lib/notifications.ts` | Modify — add `profile.language` to select, use `wrapEmail` + `getEmailT`, remove signature from HTML |
| `src/routes/ilmoitukset/$listingId_.$slug.tsx` | Modify — add `language` to owner and renter `PartyInfo` |
| `src/routes/omat/varaukset_.$bookingId.tsx` | Modify — add `language` to owner and renter `PartyInfo` |

---

## Task 1: MJML layout + wrapEmail helper

**Files:**
- Create: `src/lib/email-templates/layout.mjml`
- Create: `src/lib/email-templates/layout.html`
- Create: `src/lib/email-wrapper.ts`
- Create: `src/lib/email-wrapper.test.ts`

- [ ] **Step 1: Create the MJML layout source**

Create `src/lib/email-templates/layout.mjml`:

```xml
<mjml lang="fi">
  <mj-head>
    <mj-title>Motori</mj-title>
    <mj-font name="Manrope" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Manrope, Arial, sans-serif" />
      <mj-text font-size="15px" line-height="1.6" color="#1a1a2e" padding="0" />
    </mj-attributes>
    <mj-style>
      p { margin: 0 0 16px 0; }
      p:last-child { margin-bottom: 0; }
      a { color: #ad5016; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#fafaf9" width="600px">
    <mj-section background-color="#1a1a2e" padding="24px 32px">
      <mj-column>
        <mj-text align="center" font-size="22px" font-weight="700" color="#ffffff" padding="0 0 8px 0">
          Motori
        </mj-text>
        <mj-divider border-color="#e07a3a" border-width="2px" width="32px" padding="0" />
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="32px 32px 24px">
      <mj-column>
        <mj-raw>{{content}}</mj-raw>
      </mj-column>
    </mj-section>
    <mj-section background-color="#f0efed" padding="16px 32px">
      <mj-column>
        <mj-text align="center" font-size="13px" color="#6b6966" padding="0">
          <a href="https://motori.fi" style="color: #6b6966; text-decoration: none;">motori.fi</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
```

- [ ] **Step 2: Compile the MJML to HTML**

```bash
cd src/lib/email-templates
npx mjml layout.mjml -o layout.html --config.minify=true --config.validationLevel=strict
```

Expected: `layout.html` created with no validation errors. If `npx mjml` fails, run `pnpm add -D mjml` first and use `./node_modules/.bin/mjml` instead.

Verify `{{content}}` survived compilation:
```bash
grep -c '{{content}}' src/lib/email-templates/layout.html
```
Expected output: `1`

- [ ] **Step 3: Write the failing test**

Create `src/lib/email-wrapper.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { wrapEmail } from "./email-wrapper";

describe("wrapEmail", () => {
  test("replaces {{content}} with provided HTML", () => {
    const result = wrapEmail("<p>Hello</p>");
    expect(result).toContain("<p>Hello</p>");
    expect(result).not.toContain("{{content}}");
  });

  test("includes Motori brand header", () => {
    const result = wrapEmail("<p>Test</p>");
    expect(result).toContain("Motori");
  });

  test("includes motori.fi footer link", () => {
    const result = wrapEmail("<p>Test</p>");
    expect(result).toContain("motori.fi");
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails**

```bash
pnpm test -- src/lib/email-wrapper.test.ts
```

Expected: FAIL — `Cannot find module './email-wrapper'`

- [ ] **Step 5: Create email-wrapper.ts**

Open `src/lib/email-templates/layout.html` and copy its entire minified contents as the string value of `LAYOUT`. The file will look like:

```typescript
// Compiled from src/lib/email-templates/layout.mjml
// To regenerate: npx mjml layout.mjml -o layout.html --config.minify=true --config.validationLevel=strict
const LAYOUT = `<!doctype html>...PASTE FULL MINIFIED HTML HERE...`;

export function wrapEmail(content: string): string {
  return LAYOUT.replace("{{content}}", content);
}
```

Replace `...PASTE FULL MINIFIED HTML HERE...` with the actual content of `layout.html`.

- [ ] **Step 6: Run the tests to confirm they pass**

```bash
pnpm test -- src/lib/email-wrapper.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 7: Commit**

```bash
git add src/lib/email-templates/layout.mjml src/lib/email-templates/layout.html src/lib/email-wrapper.ts src/lib/email-wrapper.test.ts
git commit -m "feat: add MJML email layout and wrapEmail helper"
```

---

## Task 2: getEmailT factory

**Files:**
- Modify: `src/lib/i18n/email.ts`
- Create: `src/lib/i18n/email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/i18n/email.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import { getEmailT } from "./email";

describe("getEmailT", () => {
  test("returns Finnish translations for 'fi'", () => {
    const t = getEmailT("fi");
    expect(t("verification.subject")).toBe("Vahvista sähköpostiosoitteesi — Motori");
    expect(t("passwordReset.subject")).toBe("Vaihda salasanasi — Motori");
  });

  test("returns English translations for 'en'", () => {
    const t = getEmailT("en");
    expect(t("verification.subject")).toBe("Verify your email — Motori");
    expect(t("passwordReset.subject")).toBe("Reset your password — Motori");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm test -- src/lib/i18n/email.test.ts
```

Expected: FAIL — `getEmailT is not a function` (or similar)

- [ ] **Step 3: Replace the fixed export with a factory**

Replace the entire contents of `src/lib/i18n/email.ts`:

```typescript
import { createI18nSync } from "~/lib/i18n/server";

export function getEmailT(lang: "fi" | "en") {
  return createI18nSync(lang).getFixedT(lang, "email");
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
pnpm test -- src/lib/i18n/email.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Run typecheck to catch any existing callers of the old emailT export**

```bash
pnpm typecheck 2>&1 | grep "emailT\|email\.ts"
```

Note which files are broken — they'll be fixed in Tasks 4–6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/email.ts src/lib/i18n/email.test.ts
git commit -m "feat: replace fixed emailT with getEmailT(lang) factory"
```

---

## Task 3: English copy + humanize all copy

**Files:**
- Modify: `src/lib/i18n/resources/en/email.ts`
- Modify: `src/lib/i18n/resources/fi/email.ts`

- [ ] **Step 1: Add all missing English keys**

Replace the entire contents of `src/lib/i18n/resources/en/email.ts`:

```typescript
export default {
  verification: {
    subject: "Verify your email — Motori",
    greeting: "Hi,",
    body: "Click the link below to verify your email address:",
    expiry: "This link expires in 24 hours.",
  },
  listingExpiry: {
    subject: "Your listing expires soon — Motori",
    greeting: "Hi {{name}},",
    body: 'Your listing "{{title}}" expires in {{days}} days.',
    cta: "Sign in to renew it.",
  },
  passwordReset: {
    subject: "Reset your password — Motori",
    greeting: "Hi,",
    body: "Click the link below to reset your password:",
    expiry: "This link expires in one hour.",
  },
  bookingRequest: {
    subject: "New booking request: {{title}}",
    greeting: "Hi {{name}},",
    intro: 'You have a new booking request for "{{title}}".',
    dates: "Dates: {{start}} – {{end}} ({{days}} days)",
    renter: "Renter: {{name}} ({{email}})",
    message: "Message from the renter:",
    cta: "View the booking and respond in your account:",
  },
  bookingConfirmed: {
    subject: "Booking confirmed: {{title}}",
    greeting: "Hi {{name}},",
    body: 'Your booking for "{{title}}" from {{start}} to {{end}} has been confirmed.',
    ownerContact: "Owner contact details:",
    nextSteps: "Get in touch with the owner directly to arrange the handover.",
  },
  bookingRejected: {
    subject: "Booking request declined: {{title}}",
    greeting: "Hi {{name}},",
    body: 'Your booking request for "{{title}}" from {{start}} to {{end}} was declined.',
    reasonLabel: "Reason:",
    fallback: "You can search for another motorcycle on the site.",
  },
  bookingAutoRejected: {
    subject: "Booking request cancelled: {{title}}",
    greeting: "Hi {{name}},",
    body: "The dates {{start}} – {{end}} were booked by someone else.",
    fallback: "You can search for another date or listing on the site.",
  },
  signature: "— Motori",
} as const;
```

- [ ] **Step 2: Humanize English copy**

Apply the humanizer skill patterns to the English copy above. Key checks:
- No AI vocabulary words (crucial, vibrant, seamless, ensure, foster, etc.)
- No em dash overuse — replace with commas or periods where natural
- No collaborative artifacts (no "I hope this helps", "Let me know if...")
- No passive voice where active is clearer
- Vary sentence structure — avoid three parallel sentences of identical length
- Be specific, not vague

The copy above is already fairly clean. Verify no pattern 7 words appear (`crucial`, `enhance`, `foster`, `showcase`, `testament`, `vibrant`, `pivotal`, `landscape`, `tapestry`, `highlight`, `underscore`, `align with`, `key` as adjective, `delve`, `intricate`, `garner`).

- [ ] **Step 3: Humanize Finnish copy**

Open `src/lib/i18n/resources/fi/email.ts` and apply the same patterns. Current content:

```typescript
export default {
  verification: {
    subject: "Vahvista sähköpostiosoitteesi — Motori",
    greeting: "Hei,",
    body: "Vahvista sähköpostiosoitteesi klikkaamalla alla olevaa linkkiä:",
    expiry: "Linkki vanhenee 24 tunnissa.",
  },
  listingExpiry: {
    subject: "Ilmoituksesi vanhenee pian — Motori",
    greeting: "Hei {{name}},",
    body: 'Ilmoituksesi "{{title}}" vanhenee {{days}} päivän kuluttua.',
    cta: "Voit uusia ilmoituksen kirjautumalla sisään.",
  },
  passwordReset: {
    subject: "Vaihda salasanasi — Motori",
    greeting: "Hei,",
    body: "Vaihda salasanasi klikkaamalla alla olevaa linkkiä:",
    expiry: "Linkki vanhenee tunnin kuluttua.",
  },
  bookingRequest: {
    subject: "Uusi varauspyyntö: {{title}}",
    greeting: "Hei {{name}},",
    intro: 'Sinulle on tullut varauspyyntö ilmoituksellesi "{{title}}".',
    dates: "Päivät: {{start}} – {{end}} ({{days}} päivää)",
    renter: "Vuokraaja: {{name}} ({{email}})",
    message: "Viesti vuokraajalta:",
    cta: "Katso varaus ja vastaa omat-sivullasi:",
  },
  bookingConfirmed: {
    subject: "Varauksesi on vahvistettu: {{title}}",
    greeting: "Hei {{name}},",
    body: 'Omistaja on vahvistanut varauksesi ilmoitukselle "{{title}}" päiville {{start}} – {{end}}.',
    ownerContact: "Omistajan yhteystiedot:",
    nextSteps: "Sopikaa luovutuksesta ja muista yksityiskohdista suoraan keskenänne.",
  },
  bookingRejected: {
    subject: "Varauspyyntösi hylättiin: {{title}}",
    greeting: "Hei {{name}},",
    body: 'Omistaja hylkäsi varauspyyntösi ilmoitukselle "{{title}}" päiville {{start}} – {{end}}.',
    reasonLabel: "Perustelu:",
    fallback: "Voit etsiä toisen moottoripyörän sivustoltamme.",
  },
  bookingAutoRejected: {
    subject: "Varauspyyntösi peruuntui: {{title}}",
    greeting: "Hei {{name}},",
    body: "Päivät {{start}} – {{end}} ehdittiin varata toiselle vuokraajalle.",
    fallback: "Voit etsiä toisen ajankohdan tai toisen ilmoituksen sivustoltamme.",
  },
  signature: "— Motori",
} as const;
```

The Finnish copy is already direct and natural. Specific improvements to consider:
- `"Vahvista sähköpostiosoitteesi klikkaamalla alla olevaa linkkiä:"` — wordy; try `"Vahvista sähköpostiosoitteesi tästä linkistä:"`
- `"Vaihda salasanasi klikkaamalla alla olevaa linkkiä:"` — try `"Vaihda salasanasi tästä linkistä:"`
- `"Voit uusia ilmoituksen kirjautumalla sisään."` — fine as-is
- `"Sopikaa luovutuksesta ja muista yksityiskohdista suoraan keskenänne."` — fine as-is

Apply your judgment. Keep the natural, direct Finnish voice. Do not introduce AI vocabulary patterns.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/resources/en/email.ts src/lib/i18n/resources/fi/email.ts
git commit -m "feat: add English booking/expiry email copy, humanize all email copy"
```

---

## Task 4: Update auth.ts

**Files:**
- Modify: `src/lib/auth.ts`

The two BetterAuth email callbacks (`sendVerificationEmail`, `sendResetPassword`) receive a `user` object but not a profile. We fetch `profile.language` with one extra query. Both sends are already fire-and-forget (`.catch(() => {})`), so the extra DB call is acceptable.

- [ ] **Step 1: Update sendResetPassword**

In `src/lib/auth.ts`, replace the `sendResetPassword` callback:

```typescript
sendResetPassword: async ({ user, url }) => {
  const profile = await db
    .selectFrom("profile")
    .select("language")
    .where("user_id", "=", user.id)
    .executeTakeFirst();
  const lang = profile?.language ?? "fi";
  const t = getEmailT(lang);
  void sendEmail({
    to: user.email,
    subject: t("passwordReset.subject"),
    html: wrapEmail(`
      <p>${t("passwordReset.greeting")}</p>
      <p>${t("passwordReset.body")}</p>
      <p><a href="${url}">${url}</a></p>
      <p>${t("passwordReset.expiry")}</p>
    `),
    text: `${t("passwordReset.body")}\n${url}\n\n${t("passwordReset.expiry")}`,
  }).catch(() => {});
},
```

- [ ] **Step 2: Update sendVerificationEmail**

In `src/lib/auth.ts`, replace the `sendVerificationEmail` callback:

```typescript
sendVerificationEmail: async ({ user, url }) => {
  const profile = await db
    .selectFrom("profile")
    .select("language")
    .where("user_id", "=", user.id)
    .executeTakeFirst();
  const lang = profile?.language ?? "fi";
  const t = getEmailT(lang);
  void sendEmail({
    to: user.email,
    subject: t("verification.subject"),
    html: wrapEmail(`
      <p>${t("verification.greeting")}</p>
      <p>${t("verification.body")}</p>
      <p><a href="${url}">${url}</a></p>
      <p>${t("verification.expiry")}</p>
    `),
    text: `${t("verification.body")}\n${url}\n\n${t("verification.expiry")}`,
  }).catch(() => {});
},
```

- [ ] **Step 3: Add imports**

At the top of `src/lib/auth.ts`, add:

```typescript
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";
```

Remove the import of `emailT` from `~/lib/i18n/email` if it still exists.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "auth\.ts"
```

Expected: no errors for auth.ts

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: use branded email layout and per-user language in auth emails"
```

---

## Task 5: Update booking-emails.ts and its callers

**Files:**
- Modify: `src/lib/booking-emails.ts`
- Modify: `src/routes/ilmoitukset/$listingId_.$slug.tsx`
- Modify: `src/routes/omat/varaukset_.$bookingId.tsx`

`PartyInfo` gains a `language` field. The recipient's language determines which translation to use for each email. Booking request goes to the owner (use `owner.language`). Confirmed/rejected/auto-rejected go to the renter (use `renter.language`). The `t("signature")` call is removed — the footer in the wrapper already identifies Motori.

- [ ] **Step 1: Update booking-emails.ts**

Replace the entire contents of `src/lib/booking-emails.ts`:

```typescript
import { SITE_URL } from "~/lib/constants";
import { sendEmail } from "~/lib/email";
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";

interface PartyInfo {
  display_name: string;
  email: string;
  phone: string | null;
  language: "fi" | "en";
}

interface BookingSummary {
  short_id: string;
  listing_title: string;
  start_date: string;
  end_date: string;
}

function dayCount(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function bookingUrl(shortId: string): string {
  return `${SITE_URL}/omat/varaukset/${shortId}`;
}

export async function sendBookingRequestEmail(args: {
  booking: BookingSummary;
  owner: PartyInfo;
  renter: PartyInfo;
  message: string;
}): Promise<void> {
  const { booking, owner, renter, message } = args;
  const url = bookingUrl(booking.short_id);
  const days = dayCount(booking.start_date, booking.end_date);
  const t = getEmailT(owner.language);

  await sendEmail({
    to: owner.email,
    subject: t("bookingRequest.subject", { title: booking.listing_title }),
    html: wrapEmail(`
      <p>${t("bookingRequest.greeting", { name: owner.display_name })}</p>
      <p>${t("bookingRequest.intro", { title: booking.listing_title })}</p>
      <p>${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}</p>
      <p>${t("bookingRequest.renter", { name: renter.display_name, email: renter.email })}</p>
      <p><strong>${t("bookingRequest.message")}</strong><br>${escapeHtml(message)}</p>
      <p>${t("bookingRequest.cta")}<br><a href="${url}">${url}</a></p>
    `),
    text: `${t("bookingRequest.intro", { title: booking.listing_title })}\n\n${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}\n\n${url}`,
    idempotencyKey: `booking-request/${booking.short_id}`,
  });
}

export async function sendBookingConfirmedEmail(args: {
  booking: BookingSummary;
  renter: PartyInfo;
  owner: PartyInfo;
}): Promise<void> {
  const { booking, renter, owner } = args;
  const t = getEmailT(renter.language);
  const phoneLine = owner.phone ? `<br>${owner.phone}` : "";

  await sendEmail({
    to: renter.email,
    subject: t("bookingConfirmed.subject", { title: booking.listing_title }),
    html: wrapEmail(`
      <p>${t("bookingConfirmed.greeting", { name: renter.display_name })}</p>
      <p>${t("bookingConfirmed.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
      <p><strong>${t("bookingConfirmed.ownerContact")}</strong><br>${escapeHtml(owner.display_name)}<br>${owner.email}${phoneLine}</p>
      <p>${t("bookingConfirmed.nextSteps")}</p>
    `),
    text: `${t("bookingConfirmed.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}\n\n${owner.display_name} <${owner.email}>${owner.phone ? ` ${owner.phone}` : ""}`,
    idempotencyKey: `booking-confirmed/${booking.short_id}`,
  });
}

export async function sendBookingRejectedEmail(args: {
  booking: BookingSummary;
  renter: PartyInfo;
  reason: string | null;
}): Promise<void> {
  const { booking, renter, reason } = args;
  const t = getEmailT(renter.language);
  const reasonBlock = reason
    ? `<p><strong>${t("bookingRejected.reasonLabel")}</strong><br>${escapeHtml(reason)}</p>`
    : "";

  await sendEmail({
    to: renter.email,
    subject: t("bookingRejected.subject", { title: booking.listing_title }),
    html: wrapEmail(`
      <p>${t("bookingRejected.greeting", { name: renter.display_name })}</p>
      <p>${t("bookingRejected.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
      ${reasonBlock}
      <p>${t("bookingRejected.fallback")}</p>
    `),
    idempotencyKey: `booking-rejected/${booking.short_id}`,
  });
}

export async function sendBookingAutoRejectedEmail(args: {
  booking: BookingSummary;
  renter: PartyInfo;
}): Promise<void> {
  const { booking, renter } = args;
  const t = getEmailT(renter.language);

  await sendEmail({
    to: renter.email,
    subject: t("bookingAutoRejected.subject", { title: booking.listing_title }),
    html: wrapEmail(`
      <p>${t("bookingAutoRejected.greeting", { name: renter.display_name })}</p>
      <p>${t("bookingAutoRejected.body", { start: booking.start_date, end: booking.end_date })}</p>
      <p>${t("bookingAutoRejected.fallback")}</p>
    `),
    idempotencyKey: `booking-auto-rejected/${booking.short_id}`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
```

- [ ] **Step 2: Update the booking request caller — $listingId_.$slug.tsx**

In `src/routes/ilmoitukset/$listingId_.$slug.tsx`, the query around line 118 joins `profile`. Add `profile.language` to the select list:

```typescript
// In the selectFrom query that builds listing + owner profile data, add:
"profile.language as owner_language",
```

The renter profile is queried separately around line 141:
```typescript
const renterProfile = await db
  .selectFrom("profile")
  .select(["display_name", "phone", "show_phone", "language"])  // add "language"
  .where("user_id", "=", session.user.id)
  .executeTakeFirst();
```

Update the `sendBookingRequestEmail` call (around line 187) to add `language` to both party objects:

```typescript
void sendBookingRequestEmail({
  booking: { ... },  // unchanged
  owner: {
    display_name: listing.owner_display_name,
    email: listing.owner_email,
    phone: listing.owner_show_phone ? listing.owner_phone : null,
    language: listing.owner_language,  // add this
  },
  renter: {
    display_name: renterProfile.display_name,
    email: session.user.email,
    phone: renterProfile.show_phone ? renterProfile.phone : null,
    language: renterProfile.language,  // add this
  },
});
```

- [ ] **Step 3: Update the confirm/reject caller — varaukset_.$bookingId.tsx**

In `src/routes/omat/varaukset_.$bookingId.tsx`, the query around line 125 already joins `renter_profile` and `owner_profile`. Add language fields to the `.select([...])` array:

```typescript
"renter_profile.language as renter_language",
"owner_profile.language as owner_language",
```

Update the `sendBookingConfirmedEmail` call (around line 196):

```typescript
void sendBookingConfirmedEmail({
  booking: { ... },  // unchanged
  renter: {
    display_name: result.booking.renter_name,
    email: result.booking.renter_email,
    phone: null,
    language: result.booking.renter_language,  // add this
  },
  owner: {
    display_name: result.booking.owner_name,
    email: result.booking.owner_email,
    phone: result.booking.owner_show_phone ? result.booking.owner_phone : null,
    language: result.booking.owner_language,  // add this
  },
});
```

For the overlaps auto-reject query (around line 162), add `profile.language` to the select:

```typescript
"profile.language",
```

Update `sendBookingAutoRejectedEmail` calls in the overlaps loop to pass:

```typescript
renter: {
  display_name: overlap.display_name,
  email: overlap.email,
  phone: null,
  language: overlap.language,
},
```

The `rejectBooking` handler (around line 247) has its own separate query joining `profile`. Add `"profile.language as renter_language"` to its `.select([...])` array and pass `language: booking.renter_language` in the `renter` object of the `sendBookingRejectedEmail` call at line 296.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "booking-emails|listingId|bookingId"
```

Expected: no errors in these files

- [ ] **Step 5: Commit**

```bash
git add src/lib/booking-emails.ts src/routes/ilmoitukset/'$listingId_.$slug.tsx' src/routes/omat/'varaukset_.$bookingId.tsx'
git commit -m "feat: use branded email layout and per-user language in booking emails"
```

---

## Task 6: Update notifications.ts

**Files:**
- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Update sendListingExpiryWarnings**

Replace the entire contents of `src/lib/notifications.ts`:

```typescript
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";
import { log, withLogContext } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

const CONCURRENCY = 5;

export async function sendListingExpiryWarnings(daysAhead = 7): Promise<number> {
  return withLogContext({ task: "expiry-warnings" }, async () => {
    const rows = await db
      .selectFrom("listing")
      .innerJoin("user", "user.id", "listing.owner_id")
      .innerJoin("profile", "profile.user_id", "listing.owner_id")
      .select([
        "listing.id",
        "listing.title",
        "listing.expires_at",
        "user.email",
        "profile.display_name",
        "profile.language",
      ])
      .where("listing.status", "=", "active")
      .where("listing.expires_at", "is not", null)
      .where("listing.expires_at", "<=", sql<Date>`now() + make_interval(days => ${daysAhead})`)
      .where("listing.expires_at", ">", sql<Date>`now()`)
      .where("listing.expiry_notified_at", "is", null)
      .execute();

    let sent = 0;

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (row) => {
          if (!row.expires_at) {
            return;
          }
          const daysLeft = Math.ceil((row.expires_at.getTime() - Date.now()) / 86_400_000);
          const t = getEmailT(row.language);
          await sendEmail({
            to: row.email,
            subject: t("listingExpiry.subject"),
            html: wrapEmail(`
              <p>${t("listingExpiry.greeting", { name: row.display_name })}</p>
              <p>${t("listingExpiry.body", { title: row.title, days: daysLeft })}</p>
              <p>${t("listingExpiry.cta")}</p>
            `),
            text: `${t("listingExpiry.body", { title: row.title, days: daysLeft })}\n\n${t("listingExpiry.cta")}`,
            idempotencyKey: `expiry-warning/${row.id}`,
          });
          await db
            .updateTable("listing")
            .set({ expiry_notified_at: new Date(), updated_at: new Date() })
            .where("id", "=", row.id)
            .execute();
          log.event(EVENTS.notification.expiry_warning_sent, {
            listingId: row.id,
            daysLeft,
          });
          sent++;
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "rejected") {
          const row = batch[j];
          log.event(EVENTS.notification.expiry_warning_skipped, {
            listingId: row.id,
            reason: "send_failed",
            err: result.reason,
          });
        }
      }
    }

    return sent;
  });
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "notifications\.ts"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: use branded email layout and per-user language in listing expiry emails"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 2: Unit tests**

```bash
pnpm test
```

Expected: all tests pass, including the new `email-wrapper.test.ts` and `i18n/email.test.ts`

- [ ] **Step 3: Production build**

```bash
pnpm build
```

Expected: build succeeds with no errors or warnings about missing modules

- [ ] **Step 4: Verify no stray emailT references**

```bash
grep -r "emailT" src/ --include="*.ts" --include="*.tsx"
```

Expected: no results (all callers now use `getEmailT`)

- [ ] **Step 5: Verify no stray signature t() calls**

```bash
grep -r 't("signature")' src/ --include="*.ts" --include="*.tsx"
```

Expected: no results (signature removed from content; branding is in the wrapper footer)

- [ ] **Step 6: Final commit if any stray fixes needed**

```bash
git add -p
git commit -m "fix: clean up stray emailT references and signature calls"
```
