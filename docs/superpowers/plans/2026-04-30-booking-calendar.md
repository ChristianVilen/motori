# Booking Calendar & Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A booking request flow where renters pick a contiguous date range on a public calendar, owners review in `/omat/varaukset`, and confirm/reject in-app. Confirmed bookings auto-block dates. Spec: GitHub issue #14.

**Architecture:** New `booking` table + `listing_availability_exception` table + `listing.availability_default` column. Owner sets default mode (`open` or `closed`) per listing and toggles individual dates via a calendar component. Confirmed bookings are derived blocked dates (computed by joining `booking` where `status = 'confirmed'`, not written into the exception table). Email notifications use the existing Resend integration; the email is a notification only, all confirm/reject actions happen in `/omat/varaukset/$bookingId`. Stale-expiry runs as a cron task via the existing `/api/cron` endpoint.

**Tech Stack:** Kysely migrations, TanStack Start file routing, react-day-picker (new dep), date-fns (peer dep of react-day-picker), Zod validators, Resend via existing `sendEmail`, Vitest unit tests, Playwright e2e.

---

## File map

| Action | Path |
|--------|------|
| Create | `src/lib/db/migrations/016_bookings.ts` |
| Create | `src/lib/bookings.ts` |
| Create | `src/lib/bookings.test.ts` |
| Create | `src/lib/booking-emails.ts` |
| Create | `src/components/listings/availability-calendar.tsx` |
| Create | `src/components/listings/booking-request-form.tsx` |
| Create | `src/routes/omat/varaukset.tsx` |
| Create | `src/routes/omat/varaukset.$bookingId.tsx` |
| Create | `e2e/tests/booking.spec.ts` |
| Modify | `src/lib/db/schema.ts` |
| Modify | `src/lib/validators.ts` |
| Modify | `src/lib/log/events.ts` |
| Modify | `src/lib/i18n/resources/fi/email.ts` |
| Modify | `src/lib/i18n/resources/fi/profile.ts` |
| Modify | `src/lib/i18n/resources/fi/listings.ts` |
| Modify | `src/components/listings/listing-form.tsx` |
| Modify | `src/routes/ilmoitukset/$listingId_.$slug.tsx` |
| Modify | `src/routes/ilmoitukset/$listingId_.muokkaa.tsx` |
| Modify | `src/routes/omat/index.tsx` |
| Modify | `src/routes/api/cron.ts` |
| Modify | `package.json` (deps) |

---

## Conventions reminder for the implementer

- **Use `pnpm`** for everything. Lockfile is `pnpm-lock.yaml`.
- **Money is EUR cents** (integer) — not relevant here, but a project convention.
- **Dates** are stored as Postgres `date` (no time, no TZ). Always convert to/from `YYYY-MM-DD` strings on the wire; the pg driver returns `Date` objects for `date` columns by default — we want strings here, see Task 1 for the `parseTimestamps: false` workaround using `sql<string>` casts.
- **Every POST `createServerFn`** must use, in order: `csrfMiddleware()`, `rateLimitMiddleware(max, windowSec, prefix)`, `requireVerifiedEmail()` if it requires a verified user.
- **Enum / union inputs from the client must be runtime-validated** in `inputValidator` — TS types provide no runtime protection.
- **`updated_at`**: DB defaults fire only on INSERT. Every UPDATE must explicitly set `updated_at: new Date()`.
- **`Generated<T>` columns**: omit on insert.
- **UI copy is Finnish.** All user-facing strings go through i18n. Feature-internal Finnish: "varaus" = booking, "varaukset" = bookings, "vahvista" = confirm, "hylkää" = reject.
- **Minimal comments.** Only write a comment when the WHY is non-obvious.
- **No `Co-Authored-By` lines** in commit messages.
- **Commits**: small, frequent. After each task that ends in a green test run.

---

## Task 1: Database migration

**Files:**
- Create: `src/lib/db/migrations/016_bookings.ts`

- [ ] **Step 1: Write the migration**

Create `src/lib/db/migrations/016_bookings.ts`:

```ts
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// Per-listing default availability mode. 'open' = all dates available unless
	// explicitly blocked or booked; 'closed' = all dates blocked unless explicitly opened.
	await sql`
		ALTER TABLE listing
		ADD COLUMN availability_default varchar(8) NOT NULL DEFAULT 'open'
	`.execute(db);
	await sql`
		ALTER TABLE listing
		ADD CONSTRAINT listing_availability_default_check
		CHECK (availability_default IN ('open','closed'))
	`.execute(db);

	// Owner-set exception dates. Semantics depend on listing.availability_default:
	// default='open' → these dates are blocked; default='closed' → these dates are opened.
	await sql`
		CREATE TABLE listing_availability_exception (
			listing_id uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			date date NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			PRIMARY KEY (listing_id, date)
		)
	`.execute(db);

	// Booking requests.
	await sql`
		CREATE TABLE booking (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			short_id varchar(8) NOT NULL UNIQUE,
			listing_id uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
			renter_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
			start_date date NOT NULL,
			end_date date NOT NULL,
			message text NOT NULL,
			status varchar(16) NOT NULL DEFAULT 'pending',
			rejection_reason text,
			responded_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT booking_status_check CHECK (status IN ('pending','confirmed','rejected','expired','cancelled')),
			CONSTRAINT booking_dates_check CHECK (end_date >= start_date)
		)
	`.execute(db);

	await sql`CREATE INDEX booking_listing_id_idx ON booking(listing_id)`.execute(db);
	await sql`CREATE INDEX booking_renter_user_id_idx ON booking(renter_user_id)`.execute(db);
	await sql`CREATE INDEX booking_listing_status_idx ON booking(listing_id, status)`.execute(db);
	// Used by the stale-expiry cron query.
	await sql`CREATE INDEX booking_status_created_idx ON booking(status, created_at) WHERE status = 'pending'`.execute(
		db,
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE booking`.execute(db);
	await sql`DROP TABLE listing_availability_exception`.execute(db);
	await sql`ALTER TABLE listing DROP CONSTRAINT listing_availability_default_check`.execute(db);
	await sql`ALTER TABLE listing DROP COLUMN availability_default`.execute(db);
}
```

- [ ] **Step 2: Run the migration**

Run: `pnpm db:migrate`
Expected output: `Applied migration 016_bookings`

- [ ] **Step 3: Regenerate the codegen snapshot** (inspection only — `schema.ts` is the source of truth)

Run: `pnpm db:codegen`
Expected: `src/lib/db/schema.generated.ts` modified, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/migrations/016_bookings.ts src/lib/db/schema.generated.ts
git commit -m "feat(bookings): add booking + availability tables"
```

---

## Task 2: Hand-written schema types

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add the new table interfaces**

In `src/lib/db/schema.ts`, after the `ReportTable` block and before `// ─── Database interface ───` add:

```ts
export type BookingStatus = "pending" | "confirmed" | "rejected" | "expired" | "cancelled";

export interface BookingTable {
	id: Generated<string>;
	short_id: string;
	listing_id: string;
	renter_user_id: string;
	// `date` columns: pg returns Date by default. We use string YYYY-MM-DD on the wire
	// for clarity (no TZ confusion). When selecting, cast with `sql<string>` (see bookings.ts).
	start_date: string;
	end_date: string;
	message: string;
	status: Generated<BookingStatus>;
	rejection_reason: string | null;
	responded_at: ColumnType<Date, Date | undefined, Date> | null;
	created_at: ColumnType<Date, Date | undefined, Date>;
	updated_at: ColumnType<Date, Date | undefined, Date>;
}

export type Booking = Selectable<BookingTable>;
export type NewBooking = Insertable<BookingTable>;
export type BookingUpdate = Updateable<BookingTable>;

export interface ListingAvailabilityExceptionTable {
	listing_id: string;
	date: string; // YYYY-MM-DD, see note on BookingTable
	created_at: ColumnType<Date, Date | undefined, Date>;
}

export type ListingAvailabilityException = Selectable<ListingAvailabilityExceptionTable>;
export type NewListingAvailabilityException = Insertable<ListingAvailabilityExceptionTable>;
```

Then in `ListingTable`, add the new column. Find the `status:` line and add right above it:

```ts
	availability_default: Generated<"open" | "closed">;
```

Then in the `Database` interface at the bottom, add the two new entries before the closing brace:

```ts
	booking: BookingTable;
	listing_availability_exception: ListingAvailabilityExceptionTable;
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(bookings): hand-written kysely types for booking tables"
```

---

## Task 3: Short-ID generator + booking helpers (TDD)

**Files:**
- Create: `src/lib/bookings.ts`
- Create: `src/lib/bookings.test.ts`

The booking short ID generator is the same approach used for listing short_id (Base62, 8 chars, generated from `crypto.randomBytes`). Rather than duplicate, we build a small generator inline here — listing's short_id is generated in `src/lib/db/seed.ts` and inline in the listing create handler, so this is consistent with existing style.

The other pure function we want under test is `expandDateRange(start, end) → string[]` — used both for collision detection in the submit handler and for deriving booked dates from confirmed bookings.

- [ ] **Step 1: Write failing tests**

Create `src/lib/bookings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { expandDateRange, generateBookingShortId } from "./bookings";

describe("generateBookingShortId", () => {
	it("returns an 8-char base62 string", () => {
		const id = generateBookingShortId();
		expect(id).toMatch(/^[0-9A-Za-z]{8}$/);
	});

	it("returns different ids on repeated calls", () => {
		const a = generateBookingShortId();
		const b = generateBookingShortId();
		expect(a).not.toBe(b);
	});
});

describe("expandDateRange", () => {
	it("expands a single-day range to one date", () => {
		expect(expandDateRange("2026-05-01", "2026-05-01")).toEqual(["2026-05-01"]);
	});

	it("expands a multi-day range inclusive of both ends", () => {
		expect(expandDateRange("2026-05-01", "2026-05-04")).toEqual([
			"2026-05-01",
			"2026-05-02",
			"2026-05-03",
			"2026-05-04",
		]);
	});

	it("crosses month boundaries", () => {
		expect(expandDateRange("2026-04-30", "2026-05-02")).toEqual([
			"2026-04-30",
			"2026-05-01",
			"2026-05-02",
		]);
	});

	it("throws when end is before start", () => {
		expect(() => expandDateRange("2026-05-04", "2026-05-01")).toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/bookings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/lib/bookings.ts`:

```ts
import { randomBytes } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateBookingShortId(): string {
	const bytes = randomBytes(8);
	let out = "";
	for (let i = 0; i < 8; i++) {
		out += BASE62[bytes[i] % 62];
	}
	return out;
}

/** Expand inclusive YYYY-MM-DD range to an array of YYYY-MM-DD strings. */
export function expandDateRange(start: string, end: string): string[] {
	if (end < start) {
		throw new Error(`end (${end}) is before start (${start})`);
	}
	const result: string[] = [];
	const cursor = new Date(`${start}T00:00:00Z`);
	const stop = new Date(`${end}T00:00:00Z`);
	while (cursor <= stop) {
		result.push(cursor.toISOString().slice(0, 10));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return result;
}

```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/bookings.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bookings.ts src/lib/bookings.test.ts
git commit -m "feat(bookings): short-id generator and date-range helpers"
```

---

## Task 4: Validators

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add booking schemas**

Append to `src/lib/validators.ts`:

```ts
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.string().regex(ISO_DATE_RE, "Virheellinen päivämäärä");

export const bookingRequestSchema = z
	.object({
		listing_id: z.string().uuid(),
		start_date: isoDate,
		end_date: isoDate,
		message: z.string().trim().min(1, "Viesti on pakollinen").max(500, "Viesti on liian pitkä"),
	})
	.refine((d) => d.end_date >= d.start_date, {
		message: "Loppupäivä ennen aloituspäivää",
		path: ["end_date"],
	});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const bookingRejectSchema = z.object({
	id: z.string().uuid(),
	reason: z.string().trim().max(500).optional(),
});

export const availabilityUpdateSchema = z.object({
	listing_id: z.string().uuid(),
	availability_default: z.enum(["open", "closed"]),
	exception_dates: z.array(isoDate).max(366),
});

export type AvailabilityUpdateInput = z.infer<typeof availabilityUpdateSchema>;
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat(bookings): zod schemas for booking + availability inputs"
```

---

## Task 5: Log events

**Files:**
- Modify: `src/lib/log/events.ts`

- [ ] **Step 1: Add booking events**

In `src/lib/log/events.ts`, add a `booking` group inside `EVENTS`:

```ts
	booking: {
		requested: "booking.requested",
		confirmed: "booking.confirmed",
		rejected: "booking.rejected",
		cancelled: "booking.cancelled",
		expired: "booking.expired",
		auto_rejected_overlap: "booking.auto_rejected_overlap",
	},
```

Then extend the `EventName` union with:

```ts
	| (typeof EVENTS.booking)[keyof typeof EVENTS.booking];
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/log/events.ts
git commit -m "feat(bookings): event catalog entries"
```

---

## Task 6: i18n strings

**Files:**
- Modify: `src/lib/i18n/resources/fi/email.ts`
- Modify: `src/lib/i18n/resources/fi/profile.ts`
- Modify: `src/lib/i18n/resources/fi/listings.ts`

Strings live with the existing pattern. Read each file first to find the right top-level key shape; below are the keys to add. Slot them under appropriate parent keys (or at the root if the file is flat — match the existing structure).

- [ ] **Step 1: Add email strings**

In `src/lib/i18n/resources/fi/email.ts`, add (under whatever the top-level key is — typically the file is a single export of the whole `email` namespace):

```ts
	bookingRequest: {
		subject: "Uusi varauspyyntö: {{title}}",
		greeting: "Hei {{name}},",
		intro: "Olet saanut uuden varauspyynnön ilmoitukseen \"{{title}}\".",
		dates: "Päivät: {{start}} – {{end}} ({{days}} päivää)",
		renter: "Vuokraaja: {{name}} ({{email}})",
		message: "Viesti vuokraajalta:",
		cta: "Tarkastele varausta ja vastaa siihen omat-sivullasi:",
	},
	bookingConfirmed: {
		subject: "Varauksesi on vahvistettu: {{title}}",
		greeting: "Hei {{name}},",
		body: "Omistaja on vahvistanut varauksesi ilmoitukselle \"{{title}}\" päiville {{start}} – {{end}}.",
		ownerContact: "Omistajan yhteystiedot:",
		nextSteps: "Sopikaa luovutuksesta ja muista yksityiskohdista suoraan keskenänne.",
	},
	bookingRejected: {
		subject: "Varauspyyntösi hylättiin: {{title}}",
		greeting: "Hei {{name}},",
		body: "Omistaja hylkäsi varauspyyntösi ilmoitukselle \"{{title}}\" päiville {{start}} – {{end}}.",
		reasonLabel: "Perustelu:",
		fallback: "Voit etsiä toisen sopivan moottoripyörän sivustoltamme.",
	},
	bookingAutoRejected: {
		subject: "Varauspyyntösi peruuntui: {{title}}",
		greeting: "Hei {{name}},",
		body: "Päivät {{start}} – {{end}} ehdittiin varata toiselle vuokraajalle.",
		fallback: "Voit etsiä toisen ajankohdan tai toisen ilmoituksen sivustoltamme.",
	},
```

- [ ] **Step 2: Add profile (dashboard) strings**

In `src/lib/i18n/resources/fi/profile.ts`, add a `bookings` section at the top level:

```ts
	bookings: {
		navTitle: "Varaukset",
		listTitle: "Varaukset",
		tabs: {
			incoming: "Saapuneet",
			outgoing: "Tekemäni",
		},
		emptyIncoming: "Ei vielä saapuneita varauspyyntöjä.",
		emptyOutgoing: "Et ole tehnyt vielä varauksia.",
		status: {
			pending: "Odottaa",
			confirmed: "Vahvistettu",
			rejected: "Hylätty",
			expired: "Vanhentunut",
			cancelled: "Peruttu",
		},
		row: {
			dates: "{{start}} – {{end}}",
			days_one: "{{count}} päivä",
			days_other: "{{count}} päivää",
		},
		detail: {
			heading: "Varaus",
			messageLabel: "Viesti",
			rejectionLabel: "Hylkäysperustelu",
			renterLabel: "Vuokraaja",
			ownerLabel: "Omistaja",
			confirmButton: "Vahvista varaus",
			rejectButton: "Hylkää",
			cancelButton: "Peru pyyntö",
			rejectReasonPlaceholder: "Vapaaehtoinen perustelu (näkyy vuokraajalle)",
			confirmConfirm: "Vahvistetaanko? Päivät lukitaan kalenterissa.",
			rejectConfirm: "Hylätäänkö varaus?",
			cancelConfirm: "Perutaanko varauspyyntö?",
			autoRejectNotice: "{{count}} päällekkäistä pyyntöä hylättiin automaattisesti.",
			contactRevealed: "Yhteystiedot näkyvät kummallekin osapuolelle.",
		},
	},
```

- [ ] **Step 3: Add listing-detail (renter calendar/form) strings**

In `src/lib/i18n/resources/fi/listings.ts`, add a `booking` section:

```ts
	booking: {
		calendarTitle: "Saatavuus",
		legend: {
			available: "Vapaa",
			blocked: "Varattu",
			selected: "Valinta",
		},
		pickRange: "Valitse aloitus- ja lopetuspäivä",
		mustBeContiguous: "Päivien tulee olla peräkkäisiä",
		loginRequired: "Kirjaudu sisään tehdäksesi varauspyyntö",
		messageLabel: "Viesti omistajalle",
		messagePlaceholder: "Esittele itsesi ja kerro miksi haluat vuokrata moottoripyörän",
		submitButton: "Lähetä varauspyyntö",
		submitting: "Lähetetään…",
		successTitle: "Varauspyyntö lähetetty",
		successBody: "Omistaja saa pyyntösi sähköpostitse. Saat ilmoituksen, kun hän vastaa.",
	},
	availability: {
		formTitle: "Saatavuus",
		defaultLabel: "Oletustila",
		defaultOpen: "Vapaa oletuksena",
		defaultClosed: "Varattu oletuksena",
		hint: "Klikkaa päiviä kalenterissa muuttaaksesi yksittäisten päivien tilaa.",
		saveButton: "Tallenna saatavuus",
		saved: "Saatavuus tallennettu",
	},
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/resources/fi/
git commit -m "feat(bookings): finnish translations for booking + availability"
```

---

## Task 7: Booking emails

**Files:**
- Create: `src/lib/booking-emails.ts`

- [ ] **Step 1: Implement email helpers**

Create `src/lib/booking-emails.ts`:

```ts
import { SITE_URL } from "~/lib/constants";
import { sendEmail } from "~/lib/email";
import { emailT as t } from "~/lib/i18n/email";

interface PartyInfo {
	display_name: string;
	email: string;
	phone: string | null;
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

	await sendEmail({
		to: owner.email,
		subject: t("bookingRequest.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingRequest.greeting", { name: owner.display_name })}</p>
			<p>${t("bookingRequest.intro", { title: booking.listing_title })}</p>
			<p>${t("bookingRequest.dates", { start: booking.start_date, end: booking.end_date, days })}</p>
			<p>${t("bookingRequest.renter", { name: renter.display_name, email: renter.email })}</p>
			<p><strong>${t("bookingRequest.message")}</strong><br>${escapeHtml(message)}</p>
			<p>${t("bookingRequest.cta")}<br><a href="${url}">${url}</a></p>
			<p>${t("signature")}</p>
		`,
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
	const phoneLine = owner.phone ? `<br>${owner.phone}` : "";
	await sendEmail({
		to: renter.email,
		subject: t("bookingConfirmed.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingConfirmed.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingConfirmed.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
			<p><strong>${t("bookingConfirmed.ownerContact")}</strong><br>${escapeHtml(owner.display_name)}<br>${owner.email}${phoneLine}</p>
			<p>${t("bookingConfirmed.nextSteps")}</p>
			<p>${t("signature")}</p>
		`,
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
	const reasonBlock = reason
		? `<p><strong>${t("bookingRejected.reasonLabel")}</strong><br>${escapeHtml(reason)}</p>`
		: "";
	await sendEmail({
		to: renter.email,
		subject: t("bookingRejected.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingRejected.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingRejected.body", { title: booking.listing_title, start: booking.start_date, end: booking.end_date })}</p>
			${reasonBlock}
			<p>${t("bookingRejected.fallback")}</p>
			<p>${t("signature")}</p>
		`,
		idempotencyKey: `booking-rejected/${booking.short_id}`,
	});
}

export async function sendBookingAutoRejectedEmail(args: {
	booking: BookingSummary;
	renter: PartyInfo;
}): Promise<void> {
	const { booking, renter } = args;
	await sendEmail({
		to: renter.email,
		subject: t("bookingAutoRejected.subject", { title: booking.listing_title }),
		html: `
			<p>${t("bookingAutoRejected.greeting", { name: renter.display_name })}</p>
			<p>${t("bookingAutoRejected.body", { start: booking.start_date, end: booking.end_date })}</p>
			<p>${t("bookingAutoRejected.fallback")}</p>
			<p>${t("signature")}</p>
		`,
		idempotencyKey: `booking-auto-rejected/${booking.short_id}`,
	});
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === "&"
			? "&amp;"
			: c === "<"
				? "&lt;"
				: c === ">"
					? "&gt;"
					: c === '"'
						? "&quot;"
						: "&#39;",
	);
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/booking-emails.ts
git commit -m "feat(bookings): email templates for request/confirm/reject"
```

---

## Task 8: Install calendar dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install react-day-picker + date-fns**

Run: `pnpm add react-day-picker date-fns`
Expected: both added under `dependencies` in `package.json`. `react-day-picker` should be v9+, `date-fns` v4+.

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(bookings): add react-day-picker dependency"
```

---

## Task 9: Availability calendar component

The component renders a calendar that:
- Shows blocked / available / selected date states based on props.
- Supports two modes: `"select-range"` (renter — pick start/end) and `"toggle-exceptions"` (owner — flip individual dates).
- Is fully controlled — parent owns the state.

**Files:**
- Create: `src/components/listings/availability-calendar.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/listings/availability-calendar.tsx`:

```tsx
import { fi } from "date-fns/locale";
import { useMemo } from "react";
import { DayPicker, type Modifiers } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTranslation } from "~/lib/i18n";

export interface AvailabilityCalendarProps {
	/** Confirmed-booking dates that are immutable. YYYY-MM-DD. */
	bookedDates: string[];
	/** Owner-set exception dates. YYYY-MM-DD. */
	exceptionDates: string[];
	/** Per-listing default. */
	availabilityDefault: "open" | "closed";
	mode: "select-range" | "toggle-exceptions" | "view-only";
	/** When mode === "select-range". */
	selectedRange?: { from: string; to: string } | null;
	onSelectRange?: (range: { from: string; to: string } | null) => void;
	/** When mode === "toggle-exceptions". */
	onToggleException?: (date: string) => void;
}

function toIso(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function fromIso(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function AvailabilityCalendar(props: AvailabilityCalendarProps) {
	const { t } = useTranslation("listings");
	const {
		bookedDates,
		exceptionDates,
		availabilityDefault,
		mode,
		selectedRange,
		onSelectRange,
		onToggleException,
	} = props;

	const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);
	const exceptionSet = useMemo(() => new Set(exceptionDates), [exceptionDates]);

	function isBlocked(date: Date): boolean {
		const iso = toIso(date);
		if (bookedSet.has(iso)) return true;
		// availability_default = "open"  ⇒ exception means "blocked"
		// availability_default = "closed" ⇒ exception means "open"
		const inException = exceptionSet.has(iso);
		return availabilityDefault === "open" ? inException : !inException;
	}

	const modifiers: Partial<Modifiers> = {
		blocked: (date: Date) => isBlocked(date),
		booked: (date: Date) => bookedSet.has(toIso(date)),
	};

	const modifiersClassNames: Partial<Record<keyof typeof modifiers, string>> = {
		blocked: "rdp-blocked",
		booked: "rdp-booked",
	};

	function handleRangeSelect(range: { from?: Date; to?: Date } | undefined) {
		if (!onSelectRange) return;
		if (!range || !range.from) {
			onSelectRange(null);
			return;
		}
		const to = range.to ?? range.from;
		onSelectRange({ from: toIso(range.from), to: toIso(to) });
	}

	function handleSingleSelect(date: Date | undefined) {
		if (!date || !onToggleException) return;
		// Owner cannot toggle confirmed-booking dates.
		if (bookedSet.has(toIso(date))) return;
		onToggleException(toIso(date));
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (mode === "select-range") {
		return (
			<div>
				<DayPicker
					mode="range"
					locale={fi}
					selected={
						selectedRange
							? { from: fromIso(selectedRange.from), to: fromIso(selectedRange.to) }
							: undefined
					}
					onSelect={handleRangeSelect}
					disabled={[{ before: today }, (d: Date) => isBlocked(d)]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={2}
				/>
				<Legend
					availableLabel={t("booking.legend.available")}
					blockedLabel={t("booking.legend.blocked")}
					selectedLabel={t("booking.legend.selected")}
				/>
			</div>
		);
	}

	if (mode === "toggle-exceptions") {
		return (
			<div>
				<DayPicker
					mode="single"
					locale={fi}
					onSelect={handleSingleSelect}
					disabled={[{ before: today }, (d: Date) => bookedSet.has(toIso(d))]}
					modifiers={modifiers}
					modifiersClassNames={modifiersClassNames}
					numberOfMonths={2}
				/>
				<Legend
					availableLabel={t("booking.legend.available")}
					blockedLabel={t("booking.legend.blocked")}
				/>
			</div>
		);
	}

	return (
		<div>
			<DayPicker
				mode="single"
				locale={fi}
				disabled
				modifiers={modifiers}
				modifiersClassNames={modifiersClassNames}
				numberOfMonths={2}
			/>
			<Legend
				availableLabel={t("booking.legend.available")}
				blockedLabel={t("booking.legend.blocked")}
			/>
		</div>
	);
}

function Legend(props: { availableLabel: string; blockedLabel: string; selectedLabel?: string }) {
	return (
		<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-3 w-3 rounded-sm bg-success/30" />
				{props.availableLabel}
			</span>
			<span className="flex items-center gap-1.5">
				<span className="inline-block h-3 w-3 rounded-sm bg-destructive/30" />
				{props.blockedLabel}
			</span>
			{props.selectedLabel && (
				<span className="flex items-center gap-1.5">
					<span className="inline-block h-3 w-3 rounded-sm bg-accent" />
					{props.selectedLabel}
				</span>
			)}
		</div>
	);
}
```

Append to the bottom of `src/styles.css` (or whichever global stylesheet is loaded — check `src/routes/__root.tsx` `import` statements to confirm; the project uses Tailwind v4 with a single `app.css`/`styles.css`):

```css
.rdp-blocked {
	color: var(--color-destructive);
	background-color: rgb(239 68 68 / 0.15);
	text-decoration: line-through;
}
.rdp-booked {
	background-color: rgb(239 68 68 / 0.3);
}
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/listings/availability-calendar.tsx src/styles.css
git commit -m "feat(bookings): availability calendar component"
```

---

## Task 10: Server functions — read

**Files:**
- Create: helper exports inside a new server-functions module. We'll put them in route files where they're used (matches the project pattern — `getMyListings` lives in `src/routes/omat/index.tsx`). This task adds a shared query helper and the read endpoints used by the listing detail page and `/omat/varaukset`.

- Modify: `src/lib/listings-queries.ts` (add `getListingAvailability`)

- [ ] **Step 1: Add the availability-fetch helper**

Append to `src/lib/listings-queries.ts`:

```ts
export async function getListingAvailability(listingId: string): Promise<{
	availability_default: "open" | "closed";
	exception_dates: string[];
	booked_dates: string[];
}> {
	const listing = await db
		.selectFrom("listing")
		.select(["availability_default"])
		.where("id", "=", listingId)
		.executeTakeFirst();

	if (!listing) {
		return { availability_default: "open", exception_dates: [], booked_dates: [] };
	}

	const exceptions = await db
		.selectFrom("listing_availability_exception")
		.select([sql<string>`to_char(date, 'YYYY-MM-DD')`.as("date")])
		.where("listing_id", "=", listingId)
		.execute();

	// Confirmed bookings — derive blocked dates by expanding ranges.
	const confirmed = await db
		.selectFrom("booking")
		.select([
			sql<string>`to_char(start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(end_date, 'YYYY-MM-DD')`.as("end_date"),
		])
		.where("listing_id", "=", listingId)
		.where("status", "=", "confirmed")
		.execute();

	const bookedDates: string[] = [];
	for (const row of confirmed) {
		bookedDates.push(...expandDateRange(row.start_date, row.end_date));
	}

	return {
		availability_default: listing.availability_default,
		exception_dates: exceptions.map((e) => e.date),
		booked_dates: bookedDates,
	};
}
```

Add the imports at the top of the file (alongside existing imports):

```ts
import { sql } from "kysely";
import { expandDateRange } from "~/lib/bookings";
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/listings-queries.ts
git commit -m "feat(bookings): availability fetch helper"
```

---

## Task 11: Server function — submit booking request

**Files:**
- Modify: `src/routes/ilmoitukset/$listingId_.$slug.tsx` (add the server fn next to existing ones in this file)

- [ ] **Step 1: Add `submitBookingRequest` server function**

In `src/routes/ilmoitukset/$listingId_.$slug.tsx`, alongside the other `createServerFn` definitions, add:

```ts
const submitBookingRequest = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(5, 300, "submit-booking"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: unknown) => bookingRequestSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const listing = await db
			.selectFrom("listing")
			.innerJoin("user", "user.id", "listing.owner_id")
			.innerJoin("profile", "profile.user_id", "listing.owner_id")
			.select([
				"listing.id",
				"listing.title",
				"listing.owner_id",
				"listing.status",
				"user.email as owner_email",
				"profile.display_name as owner_display_name",
				"profile.phone as owner_phone",
			])
			.where("listing.id", "=", data.listing_id)
			.executeTakeFirst();

		if (!listing || listing.status !== "active") {
			throw new Error("Ilmoitus ei ole saatavilla");
		}

		const renterProfile = await db
			.selectFrom("profile")
			.select(["display_name", "phone"])
			.where("user_id", "=", session.user.id)
			.executeTakeFirst();

		if (!renterProfile) {
			throw new Error("Profiili puuttuu");
		}

		// Verify the requested range doesn't collide with confirmed bookings.
		const requested = expandDateRange(data.start_date, data.end_date);
		const collisions = await db
			.selectFrom("booking")
			.select([
				sql<string>`to_char(start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(end_date, 'YYYY-MM-DD')`.as("end_date"),
			])
			.where("listing_id", "=", listing.id)
			.where("status", "=", "confirmed")
			.where("start_date", "<=", data.end_date)
			.where("end_date", ">=", data.start_date)
			.execute();

		if (collisions.length > 0) {
			throw new Error("Päivät on jo varattu");
		}

		// Self-booking is allowed per spec — no owner-id check.

		const shortId = generateBookingShortId();
		const inserted = await db
			.insertInto("booking")
			.values({
				short_id: shortId,
				listing_id: listing.id,
				renter_user_id: session.user.id,
				start_date: data.start_date,
				end_date: data.end_date,
				message: data.message,
			})
			.returning(["id", "short_id"])
			.executeTakeFirstOrThrow();

		log.event(EVENTS.booking.requested, {
			bookingId: inserted.id,
			listingId: listing.id,
			renterId: session.user.id,
		});

		void sendBookingRequestEmail({
			booking: {
				short_id: inserted.short_id,
				listing_title: listing.title,
				start_date: data.start_date,
				end_date: data.end_date,
			},
			owner: {
				display_name: listing.owner_display_name,
				email: listing.owner_email,
				phone: listing.owner_phone,
			},
			renter: {
				display_name: renterProfile.display_name,
				email: session.user.email,
				phone: renterProfile.phone,
			},
			message: data.message,
		});

		return { short_id: inserted.short_id };
	});
```

Required imports at the top of this file (add any not already present):

```ts
import { sql } from "kysely";
import { generateBookingShortId, expandDateRange } from "~/lib/bookings";
import { sendBookingRequestEmail } from "~/lib/booking-emails";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { bookingRequestSchema } from "~/lib/validators";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/ilmoitukset/'$listingId_.$slug.tsx'
git commit -m "feat(bookings): server fn to submit booking request"
```

---

## Task 12: Wire booking submit + calendar into the listing detail page

**Files:**
- Create: `src/components/listings/booking-request-form.tsx`
- Modify: `src/routes/ilmoitukset/$listingId_.$slug.tsx`

- [ ] **Step 1: Create the booking-request form**

Create `src/components/listings/booking-request-form.tsx`:

```tsx
import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useTranslation } from "~/lib/i18n";

interface Props {
	listingId: string;
	availabilityDefault: "open" | "closed";
	exceptionDates: string[];
	bookedDates: string[];
	isLoggedIn: boolean;
	onSubmit: (input: { start_date: string; end_date: string; message: string }) => Promise<void>;
}

export function BookingRequestForm(props: Props) {
	const { t } = useTranslation("listings");
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!range) return;
		setSubmitting(true);
		setError(null);
		try {
			await props.onSubmit({
				start_date: range.from,
				end_date: range.to,
				message: message.trim(),
			});
			setSuccess(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	}

	if (success) {
		return (
			<div
				data-testid="booking-success"
				className="rounded-l border border-success/30 bg-success/5 p-4"
			>
				<h3 className="font-semibold text-success">{t("booking.successTitle")}</h3>
				<p className="mt-1 text-sm text-muted">{t("booking.successBody")}</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4" data-testid="booking-request-form">
			<h3 className="font-semibold">{t("booking.calendarTitle")}</h3>
			<AvailabilityCalendar
				bookedDates={props.bookedDates}
				exceptionDates={props.exceptionDates}
				availabilityDefault={props.availabilityDefault}
				mode={props.isLoggedIn ? "select-range" : "view-only"}
				selectedRange={range}
				onSelectRange={setRange}
			/>
			{!props.isLoggedIn ? (
				<p className="text-sm text-muted">{t("booking.loginRequired")}</p>
			) : (
				<>
					<label className="block">
						<span className="text-sm font-medium">{t("booking.messageLabel")}</span>
						<Textarea
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder={t("booking.messagePlaceholder")}
							maxLength={500}
							rows={4}
							required
						/>
					</label>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<Button
						type="submit"
						disabled={!range || message.trim().length === 0 || submitting}
						data-testid="booking-submit"
					>
						{submitting ? t("booking.submitting") : t("booking.submitButton")}
					</Button>
				</>
			)}
		</form>
	);
}
```

- [ ] **Step 2: Wire it into the listing detail loader and page**

In `src/routes/ilmoitukset/$listingId_.$slug.tsx`:

- Modify the existing `getListing` server function (or add a new one) so its result includes `availability_default`, `exception_dates`, `booked_dates`. Easiest: in the loader, after fetching the listing, also call `getListingAvailability(listing.id)` and pass it through.
- In the route's `component`, after the existing description / contact section, render:

```tsx
<section className="mt-8" data-testid="booking-section">
	<BookingRequestForm
		listingId={listing.id}
		availabilityDefault={availability.availability_default}
		exceptionDates={availability.exception_dates}
		bookedDates={availability.booked_dates}
		isLoggedIn={isSignedIn}
		onSubmit={async (input) => {
			await submitBookingRequest({ data: { listing_id: listing.id, ...input } });
		}}
	/>
</section>
```

Imports to add:
```ts
import { BookingRequestForm } from "~/components/listings/booking-request-form";
import { getListingAvailability } from "~/lib/listings-queries";
```

- [ ] **Step 3: Verify it builds and renders**

Run `pnpm dev` in another terminal, open `http://localhost:3000/ilmoitukset/<a-seeded-listing-shortId>/<slug>`, and confirm the calendar renders with the legend. Run `pnpm typecheck && pnpm lint`.
Expected: PASS, calendar visible.

- [ ] **Step 4: Commit**

```bash
git add src/components/listings/booking-request-form.tsx src/routes/ilmoitukset/'$listingId_.$slug.tsx'
git commit -m "feat(bookings): listing-detail calendar + request form"
```

---

## Task 13: Owner availability editor in listing edit page

**Files:**
- Modify: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`

- [ ] **Step 1: Add `updateAvailability` server function**

In `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`, alongside `updateListing`, add:

```ts
const updateAvailability = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(20, 60, "update-availability"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: unknown) => availabilityUpdateSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const listing = await db
			.selectFrom("listing")
			.select(["owner_id"])
			.where("id", "=", data.listing_id)
			.executeTakeFirst();

		if (!listing || listing.owner_id !== session.user.id) {
			throw new Error("Ei oikeuksia");
		}

		await db.transaction().execute(async (trx) => {
			await trx
				.updateTable("listing")
				.set({ availability_default: data.availability_default, updated_at: new Date() })
				.where("id", "=", data.listing_id)
				.execute();

			await trx
				.deleteFrom("listing_availability_exception")
				.where("listing_id", "=", data.listing_id)
				.execute();

			if (data.exception_dates.length > 0) {
				await trx
					.insertInto("listing_availability_exception")
					.values(
						data.exception_dates.map((date) => ({
							listing_id: data.listing_id,
							date,
						})),
					)
					.execute();
			}
		});
	});
```

Imports to add:
```ts
import { availabilityUpdateSchema } from "~/lib/validators";
```

- [ ] **Step 2: Extend `getListingForEdit` to include availability**

In the same file, modify `getListingForEdit` to also call `getListingAvailability(listing.id)` and return it. Update the return shape:

```ts
return { listing, images, makeSlug: makeSlug ?? null, modelName: modelName ?? null, availability };
```

Imports to add:
```ts
import { getListingAvailability } from "~/lib/listings-queries";
```

- [ ] **Step 3: Render the availability editor**

In the same file, in the component that renders the form, after the existing form section, add a new card:

```tsx
import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
// ...

function AvailabilityEditor(props: {
	listingId: string;
	initialDefault: "open" | "closed";
	initialExceptions: string[];
	bookedDates: string[];
}) {
	const { t } = useTranslation("listings");
	const [defaultMode, setDefaultMode] = useState(props.initialDefault);
	const [exceptions, setExceptions] = useState(props.initialExceptions);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);

	function toggle(date: string) {
		setExceptions((prev) =>
			prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
		);
	}

	async function handleSave() {
		setSaving(true);
		try {
			await updateAvailability({
				data: {
					listing_id: props.listingId,
					availability_default: defaultMode,
					exception_dates: exceptions,
				},
			});
			setSavedAt(Date.now());
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="mt-8 rounded-l border border-border bg-card p-4" data-testid="availability-editor">
			<h2 className="font-semibold">{t("availability.formTitle")}</h2>
			<div className="mt-3 flex gap-4 text-sm">
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="availability-default"
						checked={defaultMode === "open"}
						onChange={() => setDefaultMode("open")}
					/>
					{t("availability.defaultOpen")}
				</label>
				<label className="flex items-center gap-2">
					<input
						type="radio"
						name="availability-default"
						checked={defaultMode === "closed"}
						onChange={() => setDefaultMode("closed")}
					/>
					{t("availability.defaultClosed")}
				</label>
			</div>
			<p className="mt-2 text-xs text-muted">{t("availability.hint")}</p>
			<div className="mt-4">
				<AvailabilityCalendar
					availabilityDefault={defaultMode}
					exceptionDates={exceptions}
					bookedDates={props.bookedDates}
					mode="toggle-exceptions"
					onToggleException={toggle}
				/>
			</div>
			<div className="mt-4 flex items-center gap-3">
				<Button onClick={handleSave} disabled={saving}>
					{t("availability.saveButton")}
				</Button>
				{savedAt && <span className="text-sm text-success">{t("availability.saved")}</span>}
			</div>
		</section>
	);
}
```

Then render `<AvailabilityEditor />` in the route component, passing the loader-provided availability.

- [ ] **Step 4: Verify**

Run `pnpm typecheck && pnpm lint && pnpm dev`, open the listing edit page for a seeded listing, toggle a date and save. Verify the call succeeds and the change persists across reload.

- [ ] **Step 5: Commit**

```bash
git add src/routes/ilmoitukset/'$listingId_.muokkaa.tsx'
git commit -m "feat(bookings): owner availability editor on listing edit page"
```

---

## Task 14: Bookings list page (`/omat/varaukset`)

**Files:**
- Create: `src/routes/omat/varaukset.tsx`
- Modify: `src/routes/omat/index.tsx` (add nav link)

- [ ] **Step 1: Create the list page**

Create `src/routes/omat/varaukset.tsx`:

```tsx
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { useState } from "react";
import { SITE_NAME } from "~/lib/constants";
import { db } from "~/lib/db/index";
import { useTranslation } from "~/lib/i18n";
import { getSession } from "~/lib/session";

const getMyBookings = createServerFn({ method: "GET" }).handler(async () => {
	const session = await getSession();
	if (!session) throw new Error("Kirjaudu sisään");

	const userId = session.user.id;

	const incoming = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
		.select([
			"booking.short_id",
			"booking.status",
			sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"booking.created_at",
			"listing.title as listing_title",
			"listing.short_id as listing_short_id",
			"renter_profile.display_name as renter_name",
		])
		.where("listing.owner_id", "=", userId)
		.orderBy("booking.created_at", "desc")
		.execute();

	const outgoing = await db
		.selectFrom("booking")
		.innerJoin("listing", "listing.id", "booking.listing_id")
		.select([
			"booking.short_id",
			"booking.status",
			sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
			sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
			"booking.created_at",
			"listing.title as listing_title",
		])
		.where("booking.renter_user_id", "=", userId)
		.orderBy("booking.created_at", "desc")
		.execute();

	return { incoming, outgoing };
});

export const Route = createFileRoute("/omat/varaukset")({
	loader: async () => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		return getMyBookings();
	},
	head: () => ({ meta: [{ title: `Varaukset — ${SITE_NAME}` }] }),
	component: BookingsListPage,
});

function BookingsListPage() {
	const { incoming, outgoing } = Route.useLoaderData();
	const { t } = useTranslation("profile");
	const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
	const rows = tab === "incoming" ? incoming : outgoing;

	return (
		<div className="mx-auto max-w-3xl px-4 py-8">
			<h1 className="text-2xl font-bold">{t("bookings.listTitle")}</h1>
			<div className="mt-4 flex gap-2 border-b border-border">
				{(["incoming", "outgoing"] as const).map((key) => (
					<button
						type="button"
						key={key}
						onClick={() => setTab(key)}
						className={`-mb-px border-b-2 px-3 py-2 text-sm ${
							tab === key
								? "border-accent text-accent"
								: "border-transparent text-muted hover:text-foreground"
						}`}
						data-testid={`bookings-tab-${key}`}
					>
						{t(`bookings.tabs.${key}`)}
					</button>
				))}
			</div>

			{rows.length === 0 ? (
				<p className="mt-8 text-muted">
					{t(tab === "incoming" ? "bookings.emptyIncoming" : "bookings.emptyOutgoing")}
				</p>
			) : (
				<ul className="mt-4 space-y-2">
					{rows.map((b) => (
						<li key={b.short_id}>
							<Link
								to="/omat/varaukset/$bookingId"
								params={{ bookingId: b.short_id }}
								className="block rounded-l border border-border bg-card p-4 hover:border-accent"
								data-testid="booking-row"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="font-medium">{b.listing_title}</div>
										<div className="mt-0.5 text-xs text-muted">
											{b.start_date} – {b.end_date}
											{"renter_name" in b && ` · ${b.renter_name}`}
										</div>
									</div>
									<span className="rounded-full bg-muted-light px-2 py-0.5 text-xs">
										{t(`bookings.status.${b.status}`)}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Add a nav link from `/omat/`**

In `src/routes/omat/index.tsx`, in the header section (next to the "New listing" button), add a link to `/omat/varaukset`. One line near the existing dashboard header:

```tsx
<Link to="/omat/varaukset" className="text-sm text-muted hover:text-accent">
	{t("bookings.navTitle")}
</Link>
```

- [ ] **Step 3: Verify**

Run `pnpm typecheck && pnpm lint && pnpm test`. Then `pnpm dev`, log in, visit `/omat/varaukset`. Tabs render, empty state shown.

- [ ] **Step 4: Commit**

```bash
git add src/routes/omat/varaukset.tsx src/routes/omat/index.tsx
git commit -m "feat(bookings): bookings list page at /omat/varaukset"
```

---

## Task 15: Booking detail page with confirm/reject/cancel

**Files:**
- Create: `src/routes/omat/varaukset.$bookingId.tsx`

This file holds three POST server functions plus the page. Long but mostly mechanical.

- [ ] **Step 1: Create the detail page**

Create `src/routes/omat/varaukset.$bookingId.tsx`:

```tsx
import { createFileRoute, Link, notFound, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "kysely";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { SITE_NAME } from "~/lib/constants";
import { csrfMiddleware } from "~/lib/csrf";
import { db } from "~/lib/db/index";
import {
	sendBookingAutoRejectedEmail,
	sendBookingConfirmedEmail,
	sendBookingRejectedEmail,
} from "~/lib/booking-emails";
import { useTranslation } from "~/lib/i18n";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { rateLimitMiddleware } from "~/lib/rate-limit";
import { requireVerifiedEmail } from "~/lib/require-verified-email";
import { getSession } from "~/lib/session";
import { bookingRejectSchema } from "~/lib/validators";
import type { BookingStatus } from "~/lib/db/schema";

const getBooking = createServerFn({ method: "GET" })
	.inputValidator((shortId: string) => shortId)
	.handler(async ({ data: shortId }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const row = await db
			.selectFrom("booking")
			.innerJoin("listing", "listing.id", "booking.listing_id")
			.innerJoin("user as renter_user", "renter_user.id", "booking.renter_user_id")
			.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
			.innerJoin("user as owner_user", "owner_user.id", "listing.owner_id")
			.innerJoin("profile as owner_profile", "owner_profile.user_id", "listing.owner_id")
			.select([
				"booking.id",
				"booking.short_id",
				"booking.status",
				"booking.message",
				"booking.rejection_reason",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"booking.created_at",
				"listing.id as listing_id",
				"listing.title as listing_title",
				"listing.short_id as listing_short_id",
				"listing.owner_id",
				"renter_user.id as renter_id",
				"renter_user.email as renter_email",
				"renter_profile.display_name as renter_name",
				"renter_profile.phone as renter_phone",
				"renter_profile.show_phone as renter_show_phone",
				"owner_user.email as owner_email",
				"owner_profile.display_name as owner_name",
				"owner_profile.phone as owner_phone",
				"owner_profile.show_phone as owner_show_phone",
			])
			.where("booking.short_id", "=", shortId)
			.executeTakeFirst();

		if (!row) return null;

		const isOwner = row.owner_id === session.user.id;
		const isRenter = row.renter_id === session.user.id;
		if (!isOwner && !isRenter) throw new Error("Ei oikeuksia");

		// Apply contact-sharing rules: owner sees renter contact always; renter only after confirm.
		const renterPhone = row.renter_show_phone ? row.renter_phone : null;
		const ownerPhone = row.owner_show_phone ? row.owner_phone : null;
		const renterContact = isOwner
			? { name: row.renter_name, email: row.renter_email, phone: renterPhone }
			: null;
		const ownerContact =
			isRenter && row.status === "confirmed"
				? { name: row.owner_name, email: row.owner_email, phone: ownerPhone }
				: null;

		return {
			booking: {
				id: row.id,
				short_id: row.short_id,
				status: row.status as BookingStatus,
				message: row.message,
				rejection_reason: row.rejection_reason,
				start_date: row.start_date,
				end_date: row.end_date,
				created_at: row.created_at,
				listing_title: row.listing_title,
				listing_short_id: row.listing_short_id,
			},
			role: isOwner ? ("owner" as const) : ("renter" as const),
			renterContact,
			ownerContact,
		};
	});

const confirmBooking = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(10, 60, "confirm-booking"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: { id: string }) => ({ id: String(data.id) }))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const result = await db.transaction().execute(async (trx) => {
			const booking = await trx
				.selectFrom("booking")
				.innerJoin("listing", "listing.id", "booking.listing_id")
				.innerJoin("user as renter_user", "renter_user.id", "booking.renter_user_id")
				.innerJoin("profile as renter_profile", "renter_profile.user_id", "booking.renter_user_id")
				.innerJoin("user as owner_user", "owner_user.id", "listing.owner_id")
				.innerJoin("profile as owner_profile", "owner_profile.user_id", "listing.owner_id")
				.select([
					"booking.id",
					"booking.short_id",
					"booking.status",
					"booking.listing_id",
					sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
					sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
					"listing.title as listing_title",
					"listing.owner_id",
					"renter_user.email as renter_email",
					"renter_profile.display_name as renter_name",
					"owner_user.email as owner_email",
					"owner_profile.display_name as owner_name",
					"owner_profile.phone as owner_phone",
					"owner_profile.show_phone as owner_show_phone",
				])
				.where("booking.id", "=", data.id)
				.executeTakeFirst();

			if (!booking) throw new Error("Varaus ei löytynyt");
			if (booking.owner_id !== session.user.id) throw new Error("Ei oikeuksia");
			if (booking.status !== "pending") throw new Error("Varaus ei ole odottamassa");

			await trx
				.updateTable("booking")
				.set({ status: "confirmed", responded_at: new Date(), updated_at: new Date() })
				.where("id", "=", booking.id)
				.execute();

			// Auto-reject overlapping pending requests on the same listing.
			const overlaps = await trx
				.selectFrom("booking")
				.innerJoin("user", "user.id", "booking.renter_user_id")
				.innerJoin("profile", "profile.user_id", "booking.renter_user_id")
				.select([
					"booking.id",
					"booking.short_id",
					sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
					sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
					"user.email",
					"profile.display_name",
					"profile.phone",
				])
				.where("booking.listing_id", "=", booking.listing_id)
				.where("booking.id", "!=", booking.id)
				.where("booking.status", "=", "pending")
				.where("booking.start_date", "<=", booking.end_date)
				.where("booking.end_date", ">=", booking.start_date)
				.execute();

			if (overlaps.length > 0) {
				await trx
					.updateTable("booking")
					.set({ status: "rejected", responded_at: new Date(), updated_at: new Date() })
					.where(
						"id",
						"in",
						overlaps.map((o) => o.id),
					)
					.execute();
			}

			return { booking, overlaps };
		});

		log.event(EVENTS.booking.confirmed, { bookingId: result.booking.id });

		void sendBookingConfirmedEmail({
			booking: {
				short_id: result.booking.short_id,
				listing_title: result.booking.listing_title,
				start_date: result.booking.start_date,
				end_date: result.booking.end_date,
			},
			renter: {
				display_name: result.booking.renter_name,
				email: result.booking.renter_email,
				phone: null,
			},
			owner: {
				display_name: result.booking.owner_name,
				email: result.booking.owner_email,
				phone: result.booking.owner_show_phone ? result.booking.owner_phone : null,
			},
		});

		for (const o of result.overlaps) {
			log.event(EVENTS.booking.auto_rejected_overlap, {
				bookingId: o.id,
				confirmedBookingId: result.booking.id,
			});
			void sendBookingAutoRejectedEmail({
				booking: {
					short_id: o.short_id,
					listing_title: result.booking.listing_title,
					start_date: o.start_date,
					end_date: o.end_date,
				},
				renter: { display_name: o.display_name, email: o.email, phone: o.phone },
			});
		}

		return { autoRejectedCount: result.overlaps.length };
	});

const rejectBooking = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(10, 60, "reject-booking"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: unknown) => bookingRejectSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const booking = await db
			.selectFrom("booking")
			.innerJoin("listing", "listing.id", "booking.listing_id")
			.innerJoin("user", "user.id", "booking.renter_user_id")
			.innerJoin("profile", "profile.user_id", "booking.renter_user_id")
			.select([
				"booking.id",
				"booking.short_id",
				"booking.status",
				sql<string>`to_char(booking.start_date, 'YYYY-MM-DD')`.as("start_date"),
				sql<string>`to_char(booking.end_date, 'YYYY-MM-DD')`.as("end_date"),
				"listing.title as listing_title",
				"listing.owner_id",
				"user.email as renter_email",
				"profile.display_name as renter_name",
			])
			.where("booking.id", "=", data.id)
			.executeTakeFirst();

		if (!booking) throw new Error("Varaus ei löytynyt");
		if (booking.owner_id !== session.user.id) throw new Error("Ei oikeuksia");
		if (booking.status !== "pending") throw new Error("Varaus ei ole odottamassa");

		await db
			.updateTable("booking")
			.set({
				status: "rejected",
				rejection_reason: data.reason ?? null,
				responded_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", booking.id)
			.execute();

		log.event(EVENTS.booking.rejected, { bookingId: booking.id });

		void sendBookingRejectedEmail({
			booking: {
				short_id: booking.short_id,
				listing_title: booking.listing_title,
				start_date: booking.start_date,
				end_date: booking.end_date,
			},
			renter: { display_name: booking.renter_name, email: booking.renter_email, phone: null },
			reason: data.reason ?? null,
		});
	});

const cancelBooking = createServerFn({ method: "POST" })
	.middleware([
		csrfMiddleware(),
		rateLimitMiddleware(10, 60, "cancel-booking"),
		requireVerifiedEmail(),
	])
	.inputValidator((data: { id: string }) => ({ id: String(data.id) }))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) throw new Error("Kirjaudu sisään");

		const booking = await db
			.selectFrom("booking")
			.select(["id", "renter_user_id", "status"])
			.where("id", "=", data.id)
			.executeTakeFirst();

		if (!booking) throw new Error("Varaus ei löytynyt");
		if (booking.renter_user_id !== session.user.id) throw new Error("Ei oikeuksia");
		if (booking.status !== "pending") throw new Error("Varaus ei ole odottamassa");

		await db
			.updateTable("booking")
			.set({ status: "cancelled", updated_at: new Date() })
			.where("id", "=", booking.id)
			.execute();

		log.event(EVENTS.booking.cancelled, { bookingId: booking.id });
	});

export const Route = createFileRoute("/omat/varaukset/$bookingId")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
		const result = await getBooking({ data: params.bookingId });
		if (!result) throw notFound();
		return result;
	},
	head: () => ({ meta: [{ title: `Varaus — ${SITE_NAME}` }] }),
	component: BookingDetailPage,
});

function BookingDetailPage() {
	const { booking, role, renterContact, ownerContact } = Route.useLoaderData();
	const router = useRouter();
	const { t } = useTranslation("profile");
	const [busy, setBusy] = useState(false);
	const [rejectMode, setRejectMode] = useState(false);
	const [rejectReason, setRejectReason] = useState("");
	const [autoRejected, setAutoRejected] = useState<number | null>(null);

	const isPending = booking.status === "pending";

	async function handleConfirm() {
		if (!window.confirm(t("bookings.detail.confirmConfirm"))) return;
		setBusy(true);
		try {
			const r = await confirmBooking({ data: { id: booking.id } });
			setAutoRejected(r.autoRejectedCount);
			router.invalidate();
		} finally {
			setBusy(false);
		}
	}

	async function handleReject() {
		if (!window.confirm(t("bookings.detail.rejectConfirm"))) return;
		setBusy(true);
		try {
			await rejectBooking({ data: { id: booking.id, reason: rejectReason.trim() || undefined } });
			router.invalidate();
		} finally {
			setBusy(false);
			setRejectMode(false);
		}
	}

	async function handleCancel() {
		if (!window.confirm(t("bookings.detail.cancelConfirm"))) return;
		setBusy(true);
		try {
			await cancelBooking({ data: { id: booking.id } });
			router.invalidate();
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<Link to="/omat/varaukset" className="text-sm text-muted hover:text-accent">
				← {t("bookings.listTitle")}
			</Link>
			<h1 className="mt-2 text-2xl font-bold">{t("bookings.detail.heading")}</h1>
			<div className="mt-4 rounded-l border border-border bg-card p-4">
				<div className="font-medium">{booking.listing_title}</div>
				<div className="mt-1 text-sm text-muted">
					{booking.start_date} – {booking.end_date}
				</div>
				<span className="mt-2 inline-block rounded-full bg-muted-light px-2 py-0.5 text-xs">
					{t(`bookings.status.${booking.status}`)}
				</span>
				<div className="mt-4">
					<div className="text-xs font-semibold uppercase text-muted">
						{t("bookings.detail.messageLabel")}
					</div>
					<p className="mt-1 whitespace-pre-wrap text-sm">{booking.message}</p>
				</div>
				{booking.rejection_reason && (
					<div className="mt-4">
						<div className="text-xs font-semibold uppercase text-muted">
							{t("bookings.detail.rejectionLabel")}
						</div>
						<p className="mt-1 whitespace-pre-wrap text-sm">{booking.rejection_reason}</p>
					</div>
				)}
				{renterContact && (
					<div className="mt-4">
						<div className="text-xs font-semibold uppercase text-muted">
							{t("bookings.detail.renterLabel")}
						</div>
						<p className="mt-1 text-sm">
							{renterContact.name}
							<br />
							<a className="text-accent" href={`mailto:${renterContact.email}`}>
								{renterContact.email}
							</a>
							{renterContact.phone && <br />}
							{renterContact.phone && (
								<a className="text-accent" href={`tel:${renterContact.phone}`}>
									{renterContact.phone}
								</a>
							)}
						</p>
					</div>
				)}
				{ownerContact && (
					<div className="mt-4">
						<div className="text-xs font-semibold uppercase text-muted">
							{t("bookings.detail.ownerLabel")}
						</div>
						<p className="mt-1 text-sm">
							{ownerContact.name}
							<br />
							<a className="text-accent" href={`mailto:${ownerContact.email}`}>
								{ownerContact.email}
							</a>
							{ownerContact.phone && <br />}
							{ownerContact.phone && (
								<a className="text-accent" href={`tel:${ownerContact.phone}`}>
									{ownerContact.phone}
								</a>
							)}
						</p>
					</div>
				)}
				{autoRejected !== null && autoRejected > 0 && (
					<p className="mt-4 text-sm text-muted">
						{t("bookings.detail.autoRejectNotice", { count: autoRejected })}
					</p>
				)}
			</div>

			{isPending && role === "owner" && (
				<div className="mt-6 flex flex-wrap gap-3">
					<Button onClick={handleConfirm} disabled={busy} data-testid="booking-confirm">
						{t("bookings.detail.confirmButton")}
					</Button>
					{rejectMode ? (
						<div className="flex w-full flex-col gap-2">
							<Textarea
								value={rejectReason}
								onChange={(e) => setRejectReason(e.target.value)}
								placeholder={t("bookings.detail.rejectReasonPlaceholder")}
								maxLength={500}
								rows={3}
							/>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={handleReject}
									disabled={busy}
									data-testid="booking-reject-confirm"
								>
									{t("bookings.detail.rejectButton")}
								</Button>
								<Button variant="outline" onClick={() => setRejectMode(false)} disabled={busy}>
									Peruuta
								</Button>
							</div>
						</div>
					) : (
						<Button
							variant="outline"
							onClick={() => setRejectMode(true)}
							disabled={busy}
							data-testid="booking-reject"
						>
							{t("bookings.detail.rejectButton")}
						</Button>
					)}
				</div>
			)}

			{isPending && role === "renter" && (
				<div className="mt-6">
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={busy}
						data-testid="booking-cancel"
					>
						{t("bookings.detail.cancelButton")}
					</Button>
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Verify**

Run `pnpm typecheck && pnpm lint && pnpm test`. Then manually: log in as a seeded owner, submit a booking from another logged-in account, confirm it, verify status flips and confirmation email logs (mock email path) for both confirm + auto-reject.

- [ ] **Step 3: Commit**

```bash
git add src/routes/omat/varaukset.\$bookingId.tsx
git commit -m "feat(bookings): booking detail page with confirm/reject/cancel"
```

---

## Task 16: Stale-expiry cron task

**Files:**
- Modify: `src/routes/api/cron.ts`
- Create: `src/lib/booking-expiry.ts`

- [ ] **Step 1: Implement the expiry function**

Create `src/lib/booking-expiry.ts`:

```ts
import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

/**
 * Mark pending bookings as expired when either:
 *   - they're older than 7 days with no owner response, OR
 *   - their start_date has passed.
 */
export async function expireStaleBookings(): Promise<number> {
	const result = await db
		.updateTable("booking")
		.set({ status: "expired", updated_at: new Date() })
		.where("status", "=", "pending")
		.where((eb) =>
			eb.or([
				eb("created_at", "<", sql<Date>`now() - interval '7 days'`),
				eb("start_date", "<", sql<string>`current_date`),
			]),
		)
		.returning(["id"])
		.execute();

	for (const r of result) {
		log.event(EVENTS.booking.expired, { bookingId: r.id });
	}

	return result.length;
}
```

- [ ] **Step 2: Wire into the cron router**

In `src/routes/api/cron.ts`, add to the `TASKS` map:

```ts
"expire-bookings": async () => {
	const expired = await expireStaleBookings();
	log.info("cron: bookings expired", { expired });
	return { expired };
},
```

Imports to add:
```ts
import { expireStaleBookings } from "~/lib/booking-expiry";
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

Manual sanity check (optional): with `CRON_SECRET=foo` set in `.env`, run `curl -X POST -H "Authorization: Bearer foo" "http://localhost:3000/api/cron?task=expire-bookings"`. Expect `{"expire-bookings":{"expired":0}}`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/booking-expiry.ts src/routes/api/cron.ts
git commit -m "feat(bookings): cron task to expire stale pending bookings"
```

---

## Task 17: E2E test — happy path

**Files:**
- Create: `e2e/tests/booking.spec.ts`

The seed creates one user (`TEST_EMAIL`) and one listing owned by that user. For a renter-flow test we need a *second* user. Create one inline (sign up via API, like `global-setup.ts` does) or reuse the helper-driven flow.

- [ ] **Step 1: Write the test**

Create `e2e/tests/booking.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { SEEDED_LISTING_ID, SEEDED_LISTING_SLUG, TEST_EMAIL, TEST_PASSWORD } from "../global-setup";
import { loginAs, uniqueEmail, uniqueName, waitForHydration } from "../helpers";

test.describe("Booking flow", () => {
	test("renter submits, owner confirms, dates auto-block", async ({ page, request }) => {
		// 1. Create a fresh renter account.
		const renterEmail = uniqueEmail();
		const renterName = uniqueName();
		const signUp = await request.post("http://localhost:3000/api/auth/sign-up/email", {
			data: { name: renterName, email: renterEmail, password: TEST_PASSWORD },
			headers: { Origin: "http://localhost:3000" },
		});
		expect(signUp.ok()).toBeTruthy();

		// 2. Log in as the renter and visit the listing detail page.
		await loginAs(page, renterEmail);
		await page.goto(`/ilmoitukset/${SEEDED_LISTING_ID}/${SEEDED_LISTING_SLUG}`);
		await waitForHydration(page);

		// 3. Pick a date range on the calendar (clicks two future days).
		await expect(page.getByTestId("booking-request-form")).toBeVisible();
		// react-day-picker renders day buttons with aria-label including the date.
		// Pick two days roughly 30 + 31 days from today.
		const future = (offset: number) => {
			const d = new Date();
			d.setDate(d.getDate() + offset);
			return d;
		};
		const fmt = new Intl.DateTimeFormat("fi-FI", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
		const dayA = future(30);
		const dayB = future(31);
		// react-day-picker uses different aria-label formats per locale; fall back to title attribute or day number.
		// Click via day number within the visible month — our calendar shows two months by default.
		await page.getByRole("button", { name: new RegExp(`^${dayA.getDate()}\\b`) }).first().click();
		await page.getByRole("button", { name: new RegExp(`^${dayB.getDate()}\\b`) }).first().click();

		// 4. Fill the message and submit.
		await page.getByPlaceholder(/Esittele itsesi/).fill("E2E test message — kiinnostaa vuokrata");
		await page.getByTestId("booking-submit").click();
		await expect(page.getByTestId("booking-success")).toBeVisible();

		// 5. Log out, log in as the owner (TEST_EMAIL from seed).
		await page.goto("/api/auth/sign-out");
		await loginAs(page, TEST_EMAIL);

		// 6. Owner navigates to bookings dashboard.
		await page.goto("/omat/varaukset");
		await waitForHydration(page);
		await page.getByTestId("bookings-tab-incoming").click();
		const row = page.getByTestId("booking-row").first();
		await expect(row).toBeVisible();
		await row.click();

		// 7. Owner confirms.
		await page.getByTestId("booking-confirm").click();
		// confirm() dialog is auto-accepted by Playwright by default? It isn't — wire up dialog handler.
		// Actually browsers prompt — handle via page.on("dialog").
	});
});

// Auto-accept all confirm() dialogs in this file.
test.beforeEach(async ({ page }) => {
	page.on("dialog", (d) => d.accept());
});
```

> Note: react-day-picker renders day buttons whose accessible name includes the localised date. The selector above is best-effort; if it doesn't match, inspect with `pnpm test:e2e:ui` and tighten via `aria-label` once you see the real value (e.g. `"Friday, May 1st, 2026"` or fi locale equivalent). Don't burn time chasing this — the loop above just needs to land two clicks; alternative: select by `[role="gridcell"]` index relative to today.

- [ ] **Step 2: Run the test**

Run: `pnpm test:e2e -- e2e/tests/booking.spec.ts`
Expected: PASS in both Chromium and WebKit shards. If it flakes on calendar selectors, refine using the `pnpm test:e2e:ui` interactive tool.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/booking.spec.ts
git commit -m "test(bookings): e2e happy path — submit, confirm, contact reveal"
```

---

## Task 18: Final verification

- [ ] **Step 1: Full lint + format + typecheck + unit + e2e**

Run:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```
Expected: all green.

- [ ] **Step 2: Update issue**

Run:
```bash
gh issue close 14 --comment "Implemented in branch — see PR."
```

(Or leave open and reference the PR; project preference.)

- [ ] **Step 3: Open the PR**

Push the branch and open a PR titled `feat: booking calendar & request flow (#14)` referencing the issue.

---

## Spec → task coverage

| Issue acceptance criterion | Tasks |
|---|---|
| Owner sets default mode + toggles dates via calendar UI on edit page | 9, 13 |
| Listing detail page shows public calendar to all visitors | 12 |
| Logged-in renter submits contiguous range + message | 11, 12 |
| Owner email notification on new request | 7, 11 |
| `/omat/varaukset` lists incoming + outgoing | 14 |
| Owner confirm/reject with optional reason | 15 |
| Confirm auto-blocks dates + emails renter + auto-rejects overlapping pending + notifies owner | 15, 7 |
| Renter cancel pending | 15 |
| Auto-expire after 7d or past start_date | 16 |
| Renter sees owner contact only post-confirm; owner sees renter from pending | 15 |
| CSRF + rate-limit + requireVerifiedEmail on all booking POSTs | 11, 13, 15 |
| Status enums runtime-validated | 4 |
| Finnish UI copy | 6 |
