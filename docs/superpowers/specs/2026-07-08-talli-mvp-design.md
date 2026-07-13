# talli.motori.fi MVP — design

Date: 2026-07-08
Status: approved design, awaiting implementation plan
Companion spec: [2026-07-08-monorepo-restructure-design.md](2026-07-08-monorepo-restructure-design.md) — must ship first

## Goal

A motorcycle owner companion app at talli.motori.fi. Core loop: keep a maintenance log per bike, get reminded when service is due, log the service from the reminder. It shares accounts, database, look, and deploy pipeline with motori.fi and should feel like the same product.

## MVP scope

In: garage (multiple vehicles), maintenance log with photos, reminders (interval-based and date-based) with daily email digests, odometer tracking, a dumb marketplace link (parts search prefiltered by make/model).

Out (deferred, tracked as GitHub issues labeled `talli` + `deferred`): document storage, fuel log, wear/consumable tracking, structured parts and real marketplace matching, car support.

## Domain notes

- Motorcycles are exempt from periodic inspection (katsastus) in Finland. No katsastus preset, copy, or tracking anywhere. Date-reminder presets are vakuutus (insurance) and ajoneuvovero (vehicle tax).
- UI copy is Finnish, same as motori.
- Money in EUR cents (integer), same as motori.

## Cars later, one hedge now

Nearly everything here is vehicle-agnostic already (make/model/year, plate, VIN, service records, odometer, generic reminders — katsastus would return as a car-only preset). The one thing cheap now and expensive later is naming, so the table and code identifiers say `vehicle`, with `vehicle_type text not null default 'motorcycle'`. Nothing else anticipates cars: routes stay `/pyorat`, copy stays motorcycle-Finnish, presets stay bike-only, no vehicle-type branching.

## Data model

All tables in the `talli` schema, snake_case, owned and migrated by the talli app only (own Kysely migration table, `migrationTableSchema: 'talli'`). Cross-schema FK to `public."user"` is intentional.

```
vehicle
  id, user_id → public."user".id
  vehicle_type            text, default 'motorcycle'
  make, model, year, nickname?, plate?, vin?
  photo_url?, thumbnail_url?
  odometer_km             current reading, denormalized
  created_at, updated_at

service_record
  id, vehicle_id → vehicle
  reminder_id? → reminder  set when the record was created by completing a reminder
  performed_at            date
  odometer_km?
  title, notes?
  cost_cents?             parts + labor as one number in MVP
  parts?                  free text in MVP; structured later for marketplace matching
  created_at, updated_at

service_record_photo
  id, service_record_id → service_record
  url, thumbnail_url, position

reminder
  id, vehicle_id → vehicle
  type                    'interval' | 'date'  (runtime-validated)
  title                   "Öljynvaihto", "Vakuutus", …
  interval_km?, interval_months?        interval type: either or both, first hit wins
  last_done_at?, last_done_km?          anchor, re-set when a service record completes it
  due_date?                             date type: the active / next absolute due date
  recurrence_dates?                     text[] of annual MM-DD anchors; non-null marks a
                                        payment reminder (tax/insurance), 1–4 dates per year
  notified_at?                          dedupe so cron emails once per due cycle
  created_at, updated_at

odometer_entry
  id, vehicle_id → vehicle
  reading_km, recorded_at
```

Conventions carried over from motori: `updated_at` set explicitly on every UPDATE, `Generated<T>` columns omitted on insert, image URLs validated against `STORAGE_PUBLIC_URL`.

### Odometer flow

Any place the user enters a km reading (service record, manual update) writes an `odometer_entry` and bumps `vehicle.odometer_km` if higher. Interval reminders compare against `vehicle.odometer_km`. No estimation in MVP; the reminder email doubles as the nudge to update mileage.

### Reminder lifecycle

- `computeDueState(reminder, vehicle) → { status: 'ok' | 'due_soon' | 'overdue', dueIn }` is a pure function evaluated at read time. `due_soon` = within 500 km or 30 days. No background state.
- A reminder can be completed from the UI ("merkitse tehdyksi"), which creates a `service_record` with `reminder_id` set and re-anchors `last_done_at`/`last_done_km` (or rolls `due_date` forward a year for date reminders). This closes the loop between reminders and the log.
- On creation, an interval reminder anchors to now and the vehicle's current odometer unless the user backfills when it was last done. A reminder with no anchor is never valid.
- Adding a vehicle offers preset reminders that are **editable inline** at creation: öljynvaihto, ketju, jarruneste (interval — prefilled km/months, adjustable) and vakuutus, ajoneuvovero (payment — the user enters the real due date(s), typically one or two; no synthetic +1yr default). Users can add arbitrary custom reminders of either type.

### Payment reminders (tax & insurance)

Vakuutus and ajoneuvovero are auto-billed in Finland, so they are modelled as recurring **payment reminders** rather than serviced items: a `date` reminder with `recurrence_dates` set (annual `MM-DD` anchors the user defines — one for a single yearly bill, two for a split ajoneuvovero erä). `due_date` stays the single source of truth for due state, sorting, and the digest; `recurrence_dates` only drives advancing:

- pure `nextRecurrence(anchors, ref, { inclusive })` returns the next `YYYY-MM-DD` occurrence of any anchor relative to `ref` (this year or next), TZ-stable via `parseLocalDate`.
- on create, `due_date = nextRecurrence(anchors, today, { inclusive: true })`.
- completion is a **one-tap "merkitse maksetuksi"** (`markReminderPaid` server fn) with no service record: it sets `due_date = nextRecurrence(anchors, due_date, { inclusive: false })` and clears `notified_at`. With a single anchor this equals the previous `+1yr` roll, so it generalizes the ordinary date reminder.

`reanchorOnComplete` gains the recurrence branch; ordinary date reminders (null `recurrence_dates`) keep the `+1yr` roll and the service-record completion path. The reminders page gains a minimal edit affordance (wiring the already-present but unused `updateReminder`) so payment anchor dates can be corrected after creation. Discriminator throughout is `recurrence_dates != null`. Out of scope: paid-amount logging, payment-history records, auto-detecting real Traficom due dates.

## Routes

Own TanStack Start app at `apps/talli`, file-based routing, Finnish paths:

```
/                               garage: vehicle cards with next-due summary;
                                empty state onboards into "lisää pyörä"
/pyorat/uusi                    add vehicle (+ preset reminders step)
/pyorat/$vehicleId              vehicle detail: log timeline, upcoming reminders,
                                odometer, link to parts search
/pyorat/$vehicleId/huolto/uusi  add service record (optionally completes a reminder)
/pyorat/$vehicleId/muistutukset manage reminders
/asetukset                      notification preferences (email on/off)
/api/health                     Dokku startup healthcheck
/api/cron                       reminder digest task endpoint (CRON_SECRET-gated)
```

No auth routes here. Login and registration link to motori.fi's existing flows with a redirect back to talli; the `.motori.fi` session cookie carries back. BetterAuth stays mounted in exactly one app (motori) and its `trustedOrigins` include talli.motori.fi.

## UI

Shell reuses `@motori/ui` (fonts, theme, nav pattern) with a "Talli" wordmark and a cross-link to motori.fi in the nav. Same product, different room. Photo uploads reuse the sharp pipeline and Hetzner Object Storage via `@motori/server`'s image storage (same bucket, `talli/` key prefix).

## Notifications

One new host-cron task following the existing `/api/cron?task=` pattern, hitting the talli app daily: select reminders that crossed into `due_soon` or `overdue` where `notified_at` is stale, send one digest email per user per day via Resend, stamp `notified_at`. Re-anchoring clears `notified_at`. Respects the per-user email preference from `/asetukset`. Crontab entry goes in `infra/cron/` beside the motori ones.

## Security

House rules apply unchanged. Every POST server fn: `csrfMiddleware()` → `rateLimitMiddleware(...)` → `requireVerifiedEmail()`. csrf validates `Origin` against talli's own canonical URL (the parameterized shared middleware from `@motori/server`), not motori's. Enum inputs (`type`, `vehicle_type`) runtime-validated in the inputValidator. Ownership checked on every vehicle/record/reminder mutation (row's `user_id` against session). Image URLs validated against `STORAGE_PUBLIC_URL`.

## Marketplace integration

The long-term differentiator: maintenance needs connect to motori.fi parts listings.

- MVP ships the dumb version only: the vehicle detail page links to motori.fi parts search prefiltered by the vehicle's make/model (`/varaosat?q=…`). Zero new backend, establishes the habit.
- Designed for, not built: once `service_record.parts` becomes structured (part type + fitment), talli can render live "varaosat tähän pyörään" matches, and a due chain reminder can deep-link to chain-kit listings. Reverse direction: a motori listing page can offer "lisää Talliin" to a logged-in buyer. These become `deferred` issues.

## Testing

Unit tests (Vitest) for `computeDueState`, odometer flow, reminder re-anchoring, and `nextRecurrence` (single vs multi anchor, year-wrap, inclusive/exclusive). One Playwright e2e happy path: log in (SSO from motori's flow with `DISABLE_EMAIL_VERIFICATION=true`), add a vehicle with presets (including an edited interval and a payment due date), add a service record completing a reminder, mark a payment reminder paid, verify the timeline and due states. E2e waits for the `data-hydrated` signal, same as motori.

## Acceptance

- talli.motori.fi serves behind SSO; a motori.fi login works there without re-authenticating.
- A user can add a vehicle, log services with photos, get preset and custom reminders, and receive the daily digest email when something is due.
- Vehicle detail links into motori.fi parts search.
- CI green including talli unit + e2e tests; deploy via the shared pipeline.
- Deferred features filed as GitHub issues (`talli`, `deferred`).
