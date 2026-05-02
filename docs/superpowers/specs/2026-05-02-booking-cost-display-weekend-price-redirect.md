# Booking cost display, weekend price point, post-login redirect

## Scope

Three small improvements to the booking flow from PR #70 review:
1. Post-login redirect to original destination
2. Total cost shown in booking form as user selects dates
3. Weekend price point (Fri–Sun) added to listings

## 1. Post-login redirect

**Problem:** `varaukset_.$bookingId.tsx` loader throws `redirect({ to: "/kirjaudu", search: { redirect: undefined } })` when unauthenticated. After login the user lands on `/` instead of the booking they came from.

**Fix:** Pass the booking path as the redirect param:
```ts
throw redirect({ to: "/kirjaudu", search: { redirect: `/omat/varaukset/${params.bookingId}` } });
```

No other changes needed — the login page's `validateSearch` and `LoginForm`'s post-success navigation already handle this correctly.

## 2. Weekend price point

**DB** — migration `018_listing_weekend_price.ts`: `ALTER TABLE listing ADD COLUMN price_per_weekend integer`. Run `db:migrate`, then `db:codegen`.

**Schema** — add `price_per_weekend: number | null` to the `Listing` interface in `schema.ts`.

**Listing form** — new optional `price_per_weekend` field in the price section (between week price and price description). i18n key: `form.fields.pricePerWeekend`.

**PricingCard** — display weekend price below week price when set: "X € / viikonloppu (pe–su)".

**i18n** — new keys in both `fi/listings.ts` and `en/listings.ts`:
- `form.fields.pricePerWeekend`
- `detail.pricing.perWeekend`

## 3. Booking cost display

**`BookingRequestForm` props** — add:
- `pricePerDayCents: number`
- `pricePerWeekCents: number | null`
- `pricePerWeekendCents: number | null`

**Cost calculation** — pure function in the form file, priority order:
1. Range is exactly Fri–Sun (3 days, start is Friday) and `pricePerWeekendCents` set → weekend price
2. Days ≥ 7 and `pricePerWeekCents` set → `floor(days/7) × week + (days%7) × day`
3. Otherwise → `days × day`

**Display** — shown below calendar when a range is selected:
- "3 pv — **90 €**" + small label "viikonloppu" if weekend rate applied
- "14 pv — **300 €**" + "viikkohinnan mukaan" if week rate applied
- "3 pv — **75 €**" for plain day rate

**Call site** — `ListingDetailPage` passes `listing.price_per_day`, `listing.price_per_week ?? null`, and `listing.price_per_weekend ?? null` into `BookingRequestForm`.

**i18n** — new keys:
- `booking.costSummary` — "{{days}} pv — {{total}}"
- `booking.costLabelWeekend` — "viikonloppu"
- `booking.costLabelWeek` — "viikkohinnan mukaan"
