# Booking Cost Display, Weekend Price & Post-Login Redirect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weekend price point to listings, show total booking cost in the booking form, and fix post-login redirect so email links land correctly after sign-in.

**Architecture:** Three independent changes: (1) a one-liner redirect fix, (2) a DB migration + schema + form + display chain for weekend pricing, (3) new props + cost calculation logic in `BookingRequestForm`. Tasks are ordered so each builds on the previous.

**Tech Stack:** TanStack Start, Kysely (Postgres), React 19, Zod, react-i18next, Tailwind v4. Use `pnpm` for all commands.

---

### Task 1: Post-login redirect fix

**Files:**
- Modify: `src/routes/omat/varaukset_.$bookingId.tsx:339–353`

- [ ] **Step 1: Fix the redirect**

In `src/routes/omat/varaukset_.$bookingId.tsx`, find the loader (around line 339) and change:

```ts
export const Route = createFileRoute("/omat/varaukset_/$bookingId")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: undefined } });
		}
```

to:

```ts
export const Route = createFileRoute("/omat/varaukset_/$bookingId")({
	loader: async ({ params }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/kirjaudu", search: { redirect: `/omat/varaukset/${params.bookingId}` } });
		}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/omat/varaukset_.$bookingId.tsx
git commit -m "fix(auth): redirect to booking page after login from email link"
```

---

### Task 2: DB migration + schema

**Files:**
- Create: `src/lib/db/migrations/018_listing_weekend_price.ts`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Write the migration**

Create `src/lib/db/migrations/018_listing_weekend_price.ts`:

```ts
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing ADD COLUMN price_per_weekend integer`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE listing DROP COLUMN price_per_weekend`.execute(db);
}
```

- [ ] **Step 2: Run the migration**

```bash
pnpm db:migrate
```

Expected: output includes `018_listing_weekend_price` as migrated.

- [ ] **Step 3: Regenerate schema types**

```bash
pnpm db:codegen
```

Expected: `src/lib/db/schema.generated.ts` updated with `price_per_weekend`.

- [ ] **Step 4: Update the hand-written schema**

In `src/lib/db/schema.ts`, add `price_per_weekend` to `ListingTable` after `price_per_week`:

```ts
	price_per_day: number; // EUR cents
	price_per_week: number | null; // EUR cents
	price_per_weekend: number | null; // EUR cents — Fri–Sun flat rate
	price_description: string | null;
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/migrations/018_listing_weekend_price.ts src/lib/db/schema.ts src/lib/db/schema.generated.ts
git commit -m "feat(listings): add price_per_weekend column to listing table"
```

---

### Task 3: Validator + i18n keys

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/lib/i18n/resources/fi/listings.ts`
- Modify: `src/lib/i18n/resources/en/listings.ts`

- [ ] **Step 1: Add price_per_weekend to the Zod schema**

In `src/lib/validators.ts`, add after `price_per_week`:

```ts
		price_per_week: z.number().min(1).max(50000).nullable().optional(),
		price_per_weekend: z.number().min(1).max(50000).nullable().optional(),
		price_description: z.string().trim().max(200).nullable().optional(),
```

- [ ] **Step 2: Add Finnish i18n keys**

In `src/lib/i18n/resources/fi/listings.ts`:

Add `pricePerWeekend` to `form.fields`:
```ts
			pricePerWeek: "Viikkohinta (€)",
			pricePerWeekend: "Viikonloppuhinta (€, pe–su)",
			priceDescription: "Lisätietoja hinnasta",
```

Add `perWeekend` to `detail.pricing`:
```ts
		pricing: {
			perDay: "/päivä",
			perWeek: "{{price}} / viikko",
			perWeekend: "{{price}} / viikonloppu (pe–su)",
		},
```

Add cost summary keys to `booking`:
```ts
		booking: {
			calendarTitle: "Saatavuus",
			// ... existing keys ...
			successBody: "Omistaja saa pyyntösi sähköpostitse. Saat ilmoituksen, kun hän vastaa.",
			costSummary: "{{days}} pv — {{total}}",
			costLabelWeekend: "viikonloppu",
			costLabelWeek: "viikkohinnan mukaan",
		},
```

- [ ] **Step 3: Add English i18n keys**

In `src/lib/i18n/resources/en/listings.ts`:

Add `pricePerWeekend` to `form.fields`:
```ts
			pricePerWeek: "Price per week (€)",
			pricePerWeekend: "Weekend price (€, Fri–Sun)",
			priceDescription: "Additional pricing info",
```

Add `perWeekend` to `detail.pricing`:
```ts
		pricing: {
			perDay: "/day",
			perWeek: "{{price}} / week",
			perWeekend: "{{price}} / weekend (Fri–Sun)",
		},
```

Add cost summary keys to `booking`:
```ts
		booking: {
			calendarTitle: "Availability",
			// ... existing keys ...
			successBody: "The owner will receive your request by email. You'll be notified when they respond.",
			costSummary: "{{days}} days — {{total}}",
			costLabelWeekend: "weekend rate",
			costLabelWeek: "weekly rate",
		},
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators.ts src/lib/i18n/resources/fi/listings.ts src/lib/i18n/resources/en/listings.ts
git commit -m "feat(listings): add price_per_weekend to validator and i18n"
```

---

### Task 4: Listing form — weekend price field

**Files:**
- Modify: `src/components/listings/listing-form.tsx`

- [ ] **Step 1: Add price_per_weekend to form defaultValues**

In `src/components/listings/listing-form.tsx`, in the `useForm` `defaultValues` block, add after `price_per_week`:

```ts
			price_per_week: initialValues?.price_per_week ?? null,
			price_per_weekend: initialValues?.price_per_weekend ?? null,
			price_description: initialValues?.price_description ?? "",
```

- [ ] **Step 2: Add the form field to the price section**

In the price section of the JSX, the current layout renders `price_per_day` and `price_per_week` in a 2-column grid, then `price_description` below. Add a new `price_per_weekend` field between them.

Replace the existing 2-column grid block (the one containing `price_per_day` and `price_per_week`) with a 3-column grid, adding the weekend field:

```tsx
					<div className="grid grid-cols-2 gap-4">
						<form.Field name="price_per_day">
							{(field) => (
								<div>
									<label
										htmlFor="price_per_day"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.pricePerDay")} <span className="text-destructive">*</span>
									</label>
									<Input
										id="price_per_day"
										type="number"
										min={1}
										max={10000}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(
												e.target.value === "" ? ("" as unknown as number) : e.target.valueAsNumber,
											)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
						<form.Field name="price_per_week">
							{(field) => (
								<div>
									<label
										htmlFor="price_per_week"
										className="mb-1 block text-sm font-medium text-foreground"
									>
										{t("form.fields.pricePerWeek")}
									</label>
									<Input
										id="price_per_week"
										type="number"
										min={1}
										max={50000}
										value={field.state.value ?? ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
										}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>
					</div>
					<form.Field name="price_per_weekend">
						{(field) => (
							<div>
								<label
									htmlFor="price_per_weekend"
									className="mb-1 block text-sm font-medium text-foreground"
								>
									{t("form.fields.pricePerWeekend")}
								</label>
								<Input
									id="price_per_weekend"
									type="number"
									min={1}
									max={50000}
									value={field.state.value ?? ""}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(e.target.value === "" ? null : e.target.valueAsNumber)
									}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/listings/listing-form.tsx
git commit -m "feat(listings): add weekend price field to listing form"
```

---

### Task 5: PricingCard — weekend price display + pass props to BookingRequestForm

**Files:**
- Modify: `src/routes/ilmoitukset/$listingId_.$slug.tsx`

- [ ] **Step 1: Add perWeekend to PricingCard**

In `src/routes/ilmoitukset/$listingId_.$slug.tsx`, find the `PricingCard` component and add `pricePerWeekendCents` prop + display. The updated interface and component:

```tsx
interface PricingCardProps {
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	listing: Listing;
	isOwner: boolean;
}

function PricingCard({ pricePerDayCents, pricePerWeekCents, pricePerWeekendCents, listing, isOwner }: PricingCardProps) {
	const { t } = useTranslation("listings");

	return (
		<div className="rounded-l border border-border bg-card p-5 shadow-sm">
			<div data-testid="price-info" className="mb-4">
				<span data-testid="price-per-day" className="text-3xl font-bold text-accent">
					{formatEur(pricePerDayCents)}
				</span>
				<span className="ml-1 text-sm text-muted">{t("detail.pricing.perDay")}</span>
				{!!pricePerWeekCents && (
					<div data-testid="price-per-week" className="mt-1 text-sm text-muted">
						{t("detail.pricing.perWeek", { price: formatEur(pricePerWeekCents) })}
					</div>
				)}
				{!!pricePerWeekendCents && (
					<div data-testid="price-per-weekend" className="mt-1 text-sm text-muted">
						{t("detail.pricing.perWeekend", { price: formatEur(pricePerWeekendCents) })}
					</div>
				)}
				{!!listing.price_description && (
					<div className="mt-1 text-xs text-muted">{listing.price_description}</div>
				)}
			</div>
			{!!isOwner && (
				<div className="mt-3 flex gap-2">
					<Link
						data-testid="listing-edit-link"
						to="/ilmoitukset/$listingId/muokkaa"
						params={{ listingId: listing.short_id }}
						className="flex-1"
					>
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.edit")}
						</Button>
					</Link>
					<Link data-testid="listing-owner-profile-link" to="/omat" className="flex-1">
						<Button variant="outline" className="w-full" size="sm">
							{t("detail.ownerActions.myListings")}
						</Button>
					</Link>
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Pass pricePerWeekendCents to PricingCard and BookingRequestForm in ListingDetailPage**

Find the right column JSX block in `ListingDetailPage` (around the `<PricingCard` and `<BookingRequestForm` usage) and update both:

```tsx
<PricingCard
	pricePerDayCents={listing.price_per_day}
	pricePerWeekCents={listing.price_per_week ?? null}
	pricePerWeekendCents={listing.price_per_weekend ?? null}
	listing={listing}
	isOwner={!!isOwner}
/>
{listing.status === "active" && !isOwner && (
	<div id="booking-form" data-testid="booking-section">
		<BookingRequestForm
			listingId={listing.id}
			availabilityDefault={availability.availability_default}
			exceptionDates={availability.exception_dates}
			bookedDates={availability.booked_dates}
			isLoggedIn={!!session}
			pricePerDayCents={listing.price_per_day}
			pricePerWeekCents={listing.price_per_week ?? null}
			pricePerWeekendCents={listing.price_per_weekend ?? null}
			onSubmit={async (input) => {
				await submitBookingRequest({
					data: { listing_id: listing.id, ...input },
				});
			}}
		/>
	</div>
)}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: errors on `BookingRequestForm` — props not yet accepted. That's fine; they'll be fixed in Task 6.

- [ ] **Step 4: Commit after Task 6 passes typecheck** — hold off, commit together with Task 6.

---

### Task 6: BookingRequestForm — cost calculation + display

**Files:**
- Modify: `src/components/listings/booking-request-form.tsx`

- [ ] **Step 1: Write the unit tests first**

In `src/lib/bookings.test.ts` (existing test file), add tests for the cost calculation function:

```ts
import { computeBookingCost } from "~/components/listings/booking-request-form";

describe("computeBookingCost", () => {
	const DAY = 2500; // 25 €
	const WEEK = 15000; // 150 €
	const WEEKEND = 4000; // 40 €

	it("uses day rate for a plain 3-day range", () => {
		// 2026-05-04 (Mon) to 2026-05-06 (Wed)
		expect(computeBookingCost("2026-05-04", "2026-05-06", DAY, null, null)).toEqual({
			totalCents: 7500,
			days: 3,
			label: null,
		});
	});

	it("uses weekend rate for Fri–Sun when set", () => {
		// 2026-05-01 (Fri) to 2026-05-03 (Sun)
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, null, WEEKEND)).toEqual({
			totalCents: 4000,
			days: 3,
			label: "weekend",
		});
	});

	it("uses day rate for Fri–Sun when no weekend price set", () => {
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, null, null)).toEqual({
			totalCents: 7500,
			days: 3,
			label: null,
		});
	});

	it("uses week rate for 7-day range", () => {
		// 2026-05-04 (Mon) to 2026-05-10 (Sun) = 7 days
		expect(computeBookingCost("2026-05-04", "2026-05-10", DAY, WEEK, null)).toEqual({
			totalCents: 15000,
			days: 7,
			label: "week",
		});
	});

	it("uses week rate for 14-day range (2 full weeks)", () => {
		expect(computeBookingCost("2026-05-04", "2026-05-17", DAY, WEEK, null)).toEqual({
			totalCents: 30000,
			days: 14,
			label: "week",
		});
	});

	it("mixes week and day rates for 10-day range", () => {
		// 1 week (15000) + 3 days (7500) = 22500
		expect(computeBookingCost("2026-05-04", "2026-05-13", DAY, WEEK, null)).toEqual({
			totalCents: 22500,
			days: 10,
			label: "week",
		});
	});

	it("weekend rate takes priority over week rate for Fri–Sun", () => {
		expect(computeBookingCost("2026-05-01", "2026-05-03", DAY, WEEK, WEEKEND)).toEqual({
			totalCents: 4000,
			days: 3,
			label: "weekend",
		});
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- src/lib/bookings.test.ts
```

Expected: FAIL — `computeBookingCost` not exported.

- [ ] **Step 3: Implement the updated BookingRequestForm**

Replace `src/components/listings/booking-request-form.tsx` with:

```tsx
import { useState } from "react";
import { AvailabilityCalendar } from "~/components/listings/availability-calendar";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatEur, useTranslation } from "~/lib/i18n";

interface Props {
	listingId: string;
	availabilityDefault: "open" | "closed";
	exceptionDates: string[];
	bookedDates: string[];
	isLoggedIn: boolean;
	pricePerDayCents: number;
	pricePerWeekCents: number | null;
	pricePerWeekendCents: number | null;
	onSubmit: (input: { start_date: string; end_date: string; message: string }) => Promise<void>;
}

export interface BookingCost {
	totalCents: number;
	days: number;
	label: "weekend" | "week" | null;
}

export function computeBookingCost(
	from: string,
	to: string,
	pricePerDayCents: number,
	pricePerWeekCents: number | null,
	pricePerWeekendCents: number | null,
): BookingCost {
	const start = new Date(`${from}T00:00:00Z`);
	const end = new Date(`${to}T00:00:00Z`);
	const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

	// Fri=5, Sun=0 in UTC
	const startDay = start.getUTCDay();
	const endDay = end.getUTCDay();
	if (days === 3 && startDay === 5 && endDay === 0 && pricePerWeekendCents) {
		return { totalCents: pricePerWeekendCents, days, label: "weekend" };
	}

	if (days >= 7 && pricePerWeekCents) {
		const fullWeeks = Math.floor(days / 7);
		const remainingDays = days % 7;
		return {
			totalCents: fullWeeks * pricePerWeekCents + remainingDays * pricePerDayCents,
			days,
			label: "week",
		};
	}

	return { totalCents: days * pricePerDayCents, days, label: null };
}

export function BookingRequestForm(props: Props) {
	const { t } = useTranslation("listings");
	const [range, setRange] = useState<{ from: string; to: string } | null>(null);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const cost = range
		? computeBookingCost(
				range.from,
				range.to,
				props.pricePerDayCents,
				props.pricePerWeekCents,
				props.pricePerWeekendCents,
			)
		: null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!range) {
			return;
		}
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
			let msg = err instanceof Error ? err.message : String(err);
			try {
				const parsed = JSON.parse(msg);
				if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
					msg = parsed.map((p) => p.message).join(", ");
				}
			} catch {
				// Not JSON, use original message
			}
			setError(msg);
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
			{cost ? (
				<div data-testid="booking-cost" className="flex items-baseline gap-2">
					<span className="font-semibold">
						{t("booking.costSummary", { days: cost.days, total: formatEur(cost.totalCents) })}
					</span>
					{cost.label === "weekend" && (
						<span className="text-xs text-muted">{t("booking.costLabelWeekend")}</span>
					)}
					{cost.label === "week" && (
						<span className="text-xs text-muted">{t("booking.costLabelWeek")}</span>
					)}
				</div>
			) : null}
			{!props.isLoggedIn ? (
				<p className="text-sm text-muted">{t("booking.loginRequired")}</p>
			) : (
				<>
					<label htmlFor="booking-message" className="block">
						<span className="text-sm font-medium">{t("booking.messageLabel")}</span>
						<Textarea
							id="booking-message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder={t("booking.messagePlaceholder")}
							maxLength={500}
							rows={4}
							required
						/>
					</label>
					{error ? <p className="text-sm text-destructive">{error}</p> : null}
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

- [ ] **Step 4: Run unit tests**

```bash
pnpm test -- src/lib/bookings.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/listings/booking-request-form.tsx src/routes/ilmoitukset/'$listingId_.$slug.tsx' src/lib/bookings.test.ts
git commit -m "feat(booking): show total cost in booking form, add weekend price display"
```

---

### Task 7: Wire up weekend price in listing create/edit routes

**Files:**
- Modify: `src/routes/ilmoitukset/uusi.tsx`
- Modify: `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`

- [ ] **Step 1: Check what create/edit routes do with pricing**

```bash
grep -n "price_per_week\|price_per_day\|price_description" src/routes/ilmoitukset/uusi.tsx src/routes/ilmoitukset/'$listingId_.muokkaa.tsx'
```

The routes insert/update listing rows from `ListingFormData`. Since `price_per_weekend` is now in both the Zod schema and the DB, verify the insert/update queries include it.

- [ ] **Step 2: Update create route**

In `src/routes/ilmoitukset/uusi.tsx`, find the `db.insertInto("listing")` call and ensure `price_per_weekend` is included:

```ts
.values({
	// ... existing fields ...
	price_per_day: Math.round(data.price_per_day * 100),
	price_per_week: data.price_per_week ? Math.round(data.price_per_week * 100) : null,
	price_per_weekend: data.price_per_weekend ? Math.round(data.price_per_weekend * 100) : null,
	price_description: data.price_description ?? null,
	// ...
})
```

- [ ] **Step 3: Update edit route**

In `src/routes/ilmoitukset/$listingId_.muokkaa.tsx`, find the `db.updateTable("listing")` call and ensure `price_per_weekend` is included:

```ts
.set({
	// ... existing fields ...
	price_per_day: Math.round(data.price_per_day * 100),
	price_per_week: data.price_per_week ? Math.round(data.price_per_week * 100) : null,
	price_per_weekend: data.price_per_weekend ? Math.round(data.price_per_weekend * 100) : null,
	price_description: data.price_description ?? null,
	updated_at: new Date(),
	// ...
})
```

Also find where the form's `initialValues` are populated from the loaded listing and add:

```ts
price_per_weekend: listing.price_per_weekend ? listing.price_per_weekend / 100 : null,
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/ilmoitukset/uusi.tsx src/routes/ilmoitukset/'$listingId_.muokkaa.tsx'
git commit -m "feat(listings): persist price_per_weekend in create and edit flows"
```
