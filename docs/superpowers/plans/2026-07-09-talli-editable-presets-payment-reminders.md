# Talli — Editable Presets & Recurring Payment Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user edit reminder values inline when adding a bike, and model Finnish tax/insurance (vakuutus, ajoneuvovero) as recurring **payment reminders** with 1–4 user-defined annual dates that advance on a one-tap "mark paid."

**Architecture:** Approach A from the spec. A `date` reminder gains a nullable `recurrence_dates text[]` column (annual `MM-DD` anchors). Non-null ⇒ payment reminder. `due_date` stays the single source of truth for due-state/digest; `recurrence_dates` only drives advancing via a new pure `nextRecurrence()` helper. Completing a payment reminder is a one-tap `markReminderPaid` server fn (no service record) that advances `due_date` to the next anchor. Ordinary date reminders keep the `+1yr` roll and the service-record completion path. The discriminator throughout is `recurrence_dates != null`.

**Tech Stack:** TanStack Start (SSR + file routing), React 19, Kysely/pg (Postgres 17), zod v4, date-fns, Vitest, Biome. All in `apps/talli`.

---

## File Structure

**New files:**
- `apps/talli/src/lib/db/migrations/002_reminder_recurrence.ts` — add `recurrence_dates` column + check constraint
- `apps/talli/src/components/recurrence-dates-editor.tsx` — shared controlled editor for a list of dates (used by add-bike + reminder editing)

**Modified files:**
- `apps/talli/src/lib/db/schema.ts` — `recurrence_dates` on `ReminderTable`
- `apps/talli/src/lib/due-state.ts` — new `nextRecurrence()`, recurrence branch in `reanchorOnComplete()`
- `apps/talli/src/lib/due-state.test.ts` — tests for both
- `apps/talli/src/lib/validators.ts` — `recurrence_dates` on `reminderFormSchema`; editable preset payload on `vehicleFormSchema`
- `apps/talli/src/lib/reminders.ts` — `reminderTypeColumns` recurrence; `markReminderPaid` server fn; select `recurrence_dates` on update
- `apps/talli/src/lib/service-records.ts` — pass `recurrence_dates` into `reanchorOnComplete`
- `apps/talli/src/lib/vehicles.ts` — build reminders from editable presets; select `recurrence_dates` in `getVehicleDetail`
- `apps/talli/src/routes/pyorat/uusi.tsx` — inline-editable preset rows
- `apps/talli/src/routes/pyorat/$vehicleId.tsx` — "Merkitse maksetuksi" for payment reminders
- `apps/talli/src/routes/pyorat/$vehicleId_.muistutukset.tsx` — edit payment reminder dates

**Conventions (from AGENTS.md):** tabs, 100-col, Finnish UI copy, `data-testid` on anything e2e touches, `updated_at: new Date()` on every UPDATE, `Generated<T>` omitted on insert, dates are `YYYY-MM-DD` strings parsed as LOCAL (never `new Date("...")`), `TalliError` for user-facing errors, `formErrorMessage` in every catch. Every POST server fn: `protectedMutation(prefix, max, windowSec)` → ownership via `getOwnedVehicle`. Run a single test file with `pnpm --filter talli test -- path`.

---

## Task 1: Migration + schema type for `recurrence_dates`

**Files:**
- Create: `apps/talli/src/lib/db/migrations/002_reminder_recurrence.ts`
- Modify: `apps/talli/src/lib/db/schema.ts:46-47`

- [ ] **Step 1: Write the migration**

Create `apps/talli/src/lib/db/migrations/002_reminder_recurrence.ts`:

```ts
import { type Kysely, sql } from "kysely";

// Payment reminders (tax/insurance) recur on annual MM-DD anchors the user
// defines. Non-null recurrence_dates marks a payment reminder; due_date stays
// the active/next absolute date that drives due-state and the digest.
export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE talli.reminder ADD COLUMN recurrence_dates text[]`.execute(db);
	await sql`
		ALTER TABLE talli.reminder
		ADD CONSTRAINT reminder_recurrence_check
		CHECK (recurrence_dates IS NULL OR type = 'date')
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER TABLE talli.reminder DROP COLUMN recurrence_dates`.execute(db);
}
```

- [ ] **Step 2: Add the column to the Kysely type**

In `apps/talli/src/lib/db/schema.ts`, change the `due_date` line (line 46) region inside `ReminderTable`. Make `recurrence_dates` **insert-optional** via `ColumnType` (nullable column, no DB default → omitting it inserts NULL) so existing inserts still typecheck before Tasks 5/7 set it:

```ts
	due_date: string | null; // date — active/next absolute due date
	// text[] of annual MM-DD anchors; non-null ⇒ payment reminder. Insert-optional (defaults NULL).
	recurrence_dates: ColumnType<string[] | null, string[] | null | undefined, string[] | null>;
	notified_at: Date | null; // dedupe: digest emails once per due cycle
```

(`ColumnType` is already imported at the top of `schema.ts`.)

- [ ] **Step 3: Run the migration against the dev DB**

Run: `docker compose up -d db && pnpm --filter talli db:migrate`
Expected: migration `002_reminder_recurrence` applied, no error. (motori's migrations must have run first for the cross-schema FK; if the DB is fresh run `pnpm db:migrate` then `pnpm --filter talli db:migrate`.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter talli typecheck`
Expected: PASS. Because `recurrence_dates` is insert-optional, the existing `createReminder`/`createVehicle` inserts (which don't set it yet) still compile.

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/lib/db/migrations/002_reminder_recurrence.ts apps/talli/src/lib/db/schema.ts
git commit -m "feat(talli): add reminder.recurrence_dates column"
```

---

## Task 2: `nextRecurrence` pure helper (TDD)

**Files:**
- Modify: `apps/talli/src/lib/due-state.ts` (add export)
- Test: `apps/talli/src/lib/due-state.test.ts` (add describe block)

- [ ] **Step 1: Write the failing tests**

Append to `apps/talli/src/lib/due-state.test.ts`:

```ts
import { nextRecurrence } from "~/lib/due-state";

describe("nextRecurrence", () => {
	it("single anchor already passed this year → next year", () => {
		expect(nextRecurrence(["03-15"], "2026-07-09", { inclusive: true })).toBe("2027-03-15");
	});

	it("single anchor still upcoming this year → this year", () => {
		expect(nextRecurrence(["09-15"], "2026-07-09", { inclusive: true })).toBe("2026-09-15");
	});

	it("multi anchor picks the nearest upcoming across the pair", () => {
		expect(nextRecurrence(["03-15", "09-15"], "2026-07-09", { inclusive: true })).toBe(
			"2026-09-15",
		);
	});

	it("exclusive advances past the current due date to the next anchor", () => {
		expect(nextRecurrence(["03-15", "09-15"], "2026-09-15", { inclusive: false })).toBe(
			"2027-03-15",
		);
	});

	it("exclusive single anchor equals +1 year", () => {
		expect(nextRecurrence(["03-15"], "2026-03-15", { inclusive: false })).toBe("2027-03-15");
	});

	it("inclusive returns the ref date itself when it is an anchor", () => {
		expect(nextRecurrence(["03-15"], "2026-03-15", { inclusive: true })).toBe("2026-03-15");
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter talli test -- due-state`
Expected: FAIL — `nextRecurrence is not a function` / not exported.

- [ ] **Step 3: Implement `nextRecurrence`**

In `apps/talli/src/lib/due-state.ts`, add after `parseLocalDate` (the `format` import already exists at the top of the file):

```ts
/**
 * The next YYYY-MM-DD occurrence of any annual MM-DD anchor relative to `ref`.
 * `inclusive` decides whether an anchor falling exactly on `ref` counts (create)
 * or must be skipped to advance (mark-paid). TZ-stable — builds Dates in local
 * time like parseLocalDate. Requires at least one anchor.
 */
export function nextRecurrence(
	anchors: string[],
	ref: string,
	opts: { inclusive: boolean },
): string {
	if (anchors.length === 0) {
		throw new Error("nextRecurrence requires at least one anchor");
	}
	const refDate = parseLocalDate(ref);
	const refYear = refDate.getFullYear();
	let best: Date | null = null;
	// refYear+1 always yields a candidate strictly after any date in refYear,
	// so `best` is guaranteed set.
	for (const year of [refYear, refYear + 1]) {
		for (const anchor of anchors) {
			const [m, d] = anchor.split("-").map(Number);
			const candidate = new Date(year, m - 1, d);
			const passes = opts.inclusive ? candidate >= refDate : candidate > refDate;
			if (passes && (best === null || candidate < best)) {
				best = candidate;
			}
		}
	}
	return format(best as Date, "yyyy-MM-dd");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter talli test -- due-state`
Expected: PASS (all `nextRecurrence` cases green, plus the existing due-state tests).

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/lib/due-state.ts apps/talli/src/lib/due-state.test.ts
git commit -m "feat(talli): add nextRecurrence recurrence helper"
```

---

## Task 3: `reanchorOnComplete` recurrence branch (TDD)

**Files:**
- Modify: `apps/talli/src/lib/due-state.ts` (extend `reanchorOnComplete`, ~lines 79-91)
- Modify: `apps/talli/src/lib/service-records.ts:29-41` (select + pass `recurrence_dates`)
- Test: `apps/talli/src/lib/due-state.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/talli/src/lib/due-state.test.ts`:

```ts
import { reanchorOnComplete } from "~/lib/due-state";

describe("reanchorOnComplete — payment reminders", () => {
	it("advances a payment reminder to the next anchor (not +1yr)", () => {
		const result = reanchorOnComplete(
			{ type: "date", due_date: "2026-03-15", recurrence_dates: ["03-15", "09-15"] },
			"2026-03-15",
			null,
		);
		expect(result).toEqual({ due_date: "2026-09-15", notified_at: null });
	});

	it("ordinary date reminder (null recurrence) still rolls +1 year", () => {
		const result = reanchorOnComplete(
			{ type: "date", due_date: "2026-03-15", recurrence_dates: null },
			"2026-04-01",
			null,
		);
		expect(result).toEqual({ due_date: "2027-03-15", notified_at: null });
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter talli test -- due-state`
Expected: FAIL — `reanchorOnComplete` does not accept `recurrence_dates` (type error) or ignores it.

- [ ] **Step 3: Extend `reanchorOnComplete`**

In `apps/talli/src/lib/due-state.ts`, replace the whole `reanchorOnComplete` function with:

```ts
/**
 * What completing a reminder writes back: interval reminders re-anchor to the
 * completion; payment reminders (recurrence_dates set) advance to the next
 * anchor; other date reminders roll due_date forward a year. Either way the
 * notified_at dedupe stamp clears so the next due cycle emails again.
 */
export function reanchorOnComplete(
	reminder: { type: ReminderType; due_date: string | null; recurrence_dates: string[] | null },
	performedAt: string,
	odometerKm: number | null,
):
	| { last_done_at: string; last_done_km: number | null; notified_at: null }
	| { due_date: string; notified_at: null } {
	if (reminder.type === "interval") {
		return { last_done_at: performedAt, last_done_km: odometerKm, notified_at: null };
	}
	const from = reminder.due_date ?? performedAt;
	if (reminder.recurrence_dates && reminder.recurrence_dates.length > 0) {
		return {
			due_date: nextRecurrence(reminder.recurrence_dates, from, { inclusive: false }),
			notified_at: null,
		};
	}
	return { due_date: format(addYears(parseLocalDate(from), 1), "yyyy-MM-dd"), notified_at: null };
}
```

- [ ] **Step 4: Update `completeReminder` to select + pass `recurrence_dates`**

In `apps/talli/src/lib/service-records.ts`, in `completeReminder`, change the select (line 31) and the `reanchorOnComplete` call (lines 37-41):

```ts
		.select([
			"id",
			"vehicle_id",
			"type",
			sql<string | null>`due_date::text`.as("due_date"),
			"recurrence_dates",
		])
```

and

```ts
	const update = reanchorOnComplete(
		{ type: reminder.type, due_date: reminder.due_date, recurrence_dates: reminder.recurrence_dates },
		performedAt,
		odometerKm,
	);
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter talli test -- due-state && pnpm --filter talli typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/talli/src/lib/due-state.ts apps/talli/src/lib/due-state.test.ts apps/talli/src/lib/service-records.ts
git commit -m "feat(talli): advance payment reminders to next anchor on completion"
```

---

## Task 4: Validators — recurrence + editable preset payload

**Files:**
- Modify: `apps/talli/src/lib/validators.ts`

- [ ] **Step 1: Add the MM-DD schema and recurrence field to `reminderFormSchema`**

In `apps/talli/src/lib/validators.ts`, add near the top (after the `isoDate` definition):

```ts
// Annual recurrence anchor: "MM-DD". Day range is generous (01-31); an overflow
// like 02-31 normalizes via Date when the occurrence is built — acceptable for MVP.
const mmdd = z
	.string()
	.regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Virheellinen päivämäärä");
const recurrenceDates = z.array(mmdd).min(1, "Anna vähintään yksi päivä").max(4);
```

- [ ] **Step 2: Add `recurrence_dates` to `reminderFormSchema` and relax the date requirement**

In the `reminderFormSchema` object, add the field alongside `due_date`:

```ts
		due_date: isoDate.nullable().optional(),
		recurrence_dates: recurrenceDates.optional(),
```

and change the `superRefine` date check so either a `due_date` or `recurrence_dates` satisfies a date reminder:

```ts
		if (
			r.type === "date" &&
			r.due_date == null &&
			(!r.recurrence_dates || r.recurrence_dates.length === 0)
		) {
			ctx.addIssue({ code: "custom", message: "Anna eräpäivä", path: ["due_date"] });
		}
```

- [ ] **Step 3: Replace `presets` on `vehicleFormSchema` with an editable payload**

In `vehicleFormSchema`, replace the `presets` line:

```ts
	presets: z
		.array(
			z.object({
				key: z.enum(presetKeys),
				interval_km: z.number().int().min(1).max(200_000).nullable().optional(),
				interval_months: z.number().int().min(1).max(120).nullable().optional(),
				recurrence_dates: recurrenceDates.optional(),
			}),
		)
		.default([]),
```

Do **not** chain `.superRefine` onto `vehicleFormSchema` itself — `updateVehicle` calls `vehicleFormSchema.omit({ presets: true })`, and `.omit` does not exist on the `ZodEffects` that `.superRefine` returns. Instead keep `vehicleFormSchema` a plain `z.object({...})` and export a separate refined schema for create. Add the preset type map near the top:

```ts
const PRESET_TYPE = new Map(REMINDER_PRESETS.map((p) => [p.key, p.type] as const));
```

and, right after the `export const vehicleFormSchema = z.object({...})` block (keep `VehicleFormData = z.infer<typeof vehicleFormSchema>` as-is), add:

```ts
// createVehicle uses this refined variant; updateVehicle keeps the plain object
// (it omits presets, so it needs neither the refinement nor ZodEffects).
export const vehicleCreateSchema = vehicleFormSchema.superRefine((v, ctx) => {
	v.presets.forEach((p, i) => {
		if (
			PRESET_TYPE.get(p.key) === "date" &&
			(!p.recurrence_dates || p.recurrence_dates.length === 0)
		) {
			ctx.addIssue({
				code: "custom",
				message: "Anna eräpäivä",
				path: ["presets", i, "recurrence_dates"],
			});
		}
	});
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter talli typecheck`
Expected: FAIL in `vehicles.ts` (it still reads `data.presets` as `string[]`) — that is fixed in Task 7. The `validators.ts` file itself must compile; if the error is only in `vehicles.ts`, proceed. Confirm no error originates in `validators.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/lib/validators.ts
git commit -m "feat(talli): validate recurrence dates + editable preset payload"
```

---

## Task 5: `reminderTypeColumns` recurrence + due_date computation

**Files:**
- Modify: `apps/talli/src/lib/reminders.ts` (`reminderTypeColumns` lines 16-29; `createReminder` today wiring; `updateReminder` select + call)

- [ ] **Step 1: Rewrite `reminderTypeColumns` to take `today` and handle recurrence**

In `apps/talli/src/lib/reminders.ts`, add the import at the top:

```ts
import { nextRecurrence } from "~/lib/due-state";
```

Replace `reminderTypeColumns` (the function body at lines 16-29) with:

```ts
function reminderTypeColumns(
	data: ReminderFormData,
	anchor: { last_done_at: string | null; last_done_km: number | null },
	today: string,
) {
	const isInterval = data.type === "interval";
	const isPayment =
		data.type === "date" && !!data.recurrence_dates && data.recurrence_dates.length > 0;
	return {
		interval_km: isInterval ? (data.interval_km ?? null) : null,
		interval_months: isInterval ? (data.interval_months ?? null) : null,
		last_done_at: isInterval ? (data.last_done_at ?? anchor.last_done_at) : null,
		last_done_km: isInterval ? (data.last_done_km ?? anchor.last_done_km) : null,
		recurrence_dates: isPayment ? data.recurrence_dates : null,
		// Payment reminders derive the active due_date from their anchors; ordinary
		// date reminders use the user's absolute due_date.
		due_date:
			data.type !== "date"
				? null
				: isPayment
					? nextRecurrence(data.recurrence_dates as string[], today, { inclusive: true })
					: (data.due_date ?? null),
	};
}
```

- [ ] **Step 2: Pass `today` from `createReminder`**

In `createReminder`, the `today` const already exists (line 42). Update the `reminderTypeColumns` call (lines 49-52) to pass it:

```ts
					...reminderTypeColumns(
						data,
						{ last_done_at: today, last_done_km: vehicle.odometer_km },
						today,
					),
```

- [ ] **Step 3: Update `updateReminder` to select `recurrence_dates` and pass `today`**

In `updateReminder`, the select of the existing reminder currently pulls `last_done_at`/`last_done_km` for the anchor. Leave those; find where it builds the anchor and calls `reminderTypeColumns` (in the `.set({ ... })`). Ensure a `today` const exists in that handler and the call passes it:

```ts
			const today = new Date().toISOString().slice(0, 10);
			const anchor = {
				last_done_at: reminder.last_done_at ?? today,
				last_done_km: reminder.last_done_km ?? vehicle.odometer_km,
			};
			await trx
				.updateTable("talli.reminder")
				.set({
					title: data.title,
					...reminderTypeColumns(data, anchor, today),
					notified_at: null,
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.execute();
```

(The `reminder` select already includes `last_done_at`/`last_done_km`; no `recurrence_dates` select is needed on update because the new anchors come entirely from `data`.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter talli typecheck`
Expected: still FAIL only in `vehicles.ts` (Task 7). `reminders.ts` must be clean.

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/lib/reminders.ts
git commit -m "feat(talli): compute payment reminder due_date from recurrence anchors"
```

---

## Task 6: `markReminderPaid` server fn

**Files:**
- Modify: `apps/talli/src/lib/reminders.ts` (add export); `apps/talli/src/lib/log/events.ts` (add event)

- [ ] **Step 1: Add the log event**

In `apps/talli/src/lib/log/events.ts`, add a `paid` event under the `reminder` group (mirror the shape of the existing `reminder.completed`):

```ts
		paid: "reminder.paid",
```

- [ ] **Step 2: Add `markReminderPaid`**

Append to `apps/talli/src/lib/reminders.ts` (it imports `reanchorOnComplete`? add it):

```ts
import { nextRecurrence, reanchorOnComplete } from "~/lib/due-state";
```

(merge with the existing `nextRecurrence` import from Task 5 into one line), then:

```ts
export const markReminderPaid = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-reminder-paid", 30, 3600))
	.inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
	.handler(async ({ data: { id } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		const { sql } = await import("kysely");

		await db.transaction().execute(async (trx) => {
			const reminder = await trx
				.selectFrom("talli.reminder")
				.select([
					"id",
					"vehicle_id",
					"type",
					sql<string | null>`due_date::text`.as("due_date"),
					"recurrence_dates",
				])
				.where("id", "=", id)
				.executeTakeFirst();
			if (!reminder || !reminder.recurrence_dates?.length) {
				throw new TalliError("Muistutusta ei löytynyt");
			}
			await getOwnedVehicle(trx, reminder.vehicle_id, userId);
			const today = new Date().toISOString().slice(0, 10);
			// reanchorOnComplete advances a payment reminder to its next anchor and
			// clears notified_at — same logic as a service completion, no record.
			const update = reanchorOnComplete(
				{ type: reminder.type, due_date: reminder.due_date, recurrence_dates: reminder.recurrence_dates },
				today,
				null,
			);
			await trx
				.updateTable("talli.reminder")
				.set({ ...update, updated_at: new Date() })
				.where("id", "=", id)
				.execute();
		});

		log.event(EVENTS.reminder.paid, { reminderId: id });
	});
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter talli typecheck`
Expected: FAIL only in `vehicles.ts` (Task 7). `reminders.ts` and `events.ts` clean.

- [ ] **Step 4: Commit**

```bash
git add apps/talli/src/lib/reminders.ts apps/talli/src/lib/log/events.ts
git commit -m "feat(talli): add markReminderPaid server fn"
```

---

## Task 7: `createVehicle` builds reminders from editable presets

**Files:**
- Modify: `apps/talli/src/lib/vehicles.ts` (`createVehicle` preset block ~lines 82-114; `getVehicleDetail` reminder select)

- [ ] **Step 1: Add imports**

In `apps/talli/src/lib/vehicles.ts`, ensure these are imported:

```ts
import { computeDueState, type DueState, nextRecurrence } from "~/lib/due-state";
```

(merge `nextRecurrence` into the existing due-state import), and switch the validators import to include `vehicleCreateSchema`:

```ts
import { isValidImageUrl, vehicleCreateSchema, vehicleFormSchema } from "~/lib/validators";
```

Then change `createVehicle`'s validator from `.inputValidator(vehicleFormSchema)` to `.inputValidator(vehicleCreateSchema)`. (`updateVehicle` keeps `vehicleFormSchema.omit({ presets: true })`.)

- [ ] **Step 2: Rebuild the preset-insertion block**

In `createVehicle`, replace the preset block (the `const presets = REMINDER_PRESETS.filter(...)` through the `trx.insertInto("talli.reminder").values(rows).execute()`) with:

```ts
			// Presets are editable at creation: interval presets carry adjustable
			// km/months (default from the catalog); payment presets (vakuutus,
			// ajoneuvovero) carry user-entered MM-DD anchors, and their due_date is
			// the next upcoming occurrence.
			const rows: NewReminder[] = data.presets.map((input) => {
				const preset = REMINDER_PRESETS.find((p) => p.key === input.key);
				if (!preset) {
					throw new TalliError("Tuntematon muistutus");
				}
				if (preset.type === "interval") {
					return {
						vehicle_id: vehicle.id,
						type: "interval" as const,
						title: preset.title,
						interval_km: input.interval_km ?? preset.interval_km ?? null,
						interval_months: input.interval_months ?? preset.interval_months ?? null,
						last_done_at: today,
						last_done_km: data.odometer_km,
						due_date: null,
						recurrence_dates: null,
						notified_at: null,
					};
				}
				const anchors = input.recurrence_dates as string[];
				return {
					vehicle_id: vehicle.id,
					type: "date" as const,
					title: preset.title,
					interval_km: null,
					interval_months: null,
					last_done_at: null,
					last_done_km: null,
					due_date: nextRecurrence(anchors, today, { inclusive: true }),
					recurrence_dates: anchors,
					notified_at: null,
				};
			});
			if (rows.length > 0) {
				await trx.insertInto("talli.reminder").values(rows).execute();
			}
```

Note: the `presets: data.presets` field logged in `EVENTS.vehicle.created` at the end of the handler must change from the raw preset objects to keys — update it to `presets: data.presets.map((p) => p.key)`.

- [ ] **Step 3: Select `recurrence_dates` in `getVehicleDetail`**

In `getVehicleDetail`, add `"recurrence_dates"` to the reminder `.select([...])` list (after the `due_date` cast line), so the detail/muistutukset UI can discriminate payment reminders:

```ts
				sql<string | null>`due_date::text`.as("due_date"),
				"recurrence_dates",
```

(Leave `getGarage` unchanged — the garage card doesn't need it.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter talli typecheck`
Expected: PASS (all server-side types now line up).

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/lib/vehicles.ts
git commit -m "feat(talli): build reminders from editable presets on vehicle create"
```

---

## Task 8: `RecurrenceDatesEditor` component

**Files:**
- Create: `apps/talli/src/components/recurrence-dates-editor.tsx`

A small controlled editor: renders one or more `<input type="date">` rows, add/remove buttons, capped at `max`. It works in full `YYYY-MM-DD` values (friendlier picker); callers slice to `MM-DD` on submit and seed with `${year}-${mmdd}` when editing.

- [ ] **Step 1: Write the component**

Create `apps/talli/src/components/recurrence-dates-editor.tsx`:

```tsx
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";

interface Props {
	/** Full YYYY-MM-DD values (one per reminder date). */
	dates: string[];
	onChange: (dates: string[]) => void;
	max?: number;
}

export function RecurrenceDatesEditor({ dates, onChange, max = 4 }: Props) {
	function setAt(i: number, value: string) {
		onChange(dates.map((d, j) => (j === i ? value : d)));
	}
	function removeAt(i: number) {
		onChange(dates.filter((_, j) => j !== i));
	}
	return (
		<div className="grid gap-2" data-testid="recurrence-dates">
			{dates.map((d, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: date rows are positional
				<div key={i} className="flex items-center gap-2">
					<Input
						type="date"
						required
						data-testid={`recurrence-date-${i}`}
						value={d}
						onChange={(e) => setAt(i, e.target.value)}
					/>
					{dates.length > 1 ? (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							data-testid={`recurrence-remove-${i}`}
							onClick={() => removeAt(i)}
						>
							Poista
						</Button>
					) : null}
				</div>
			))}
			{dates.length < max ? (
				<Button
					type="button"
					size="sm"
					variant="outline"
					data-testid="recurrence-add"
					onClick={() => onChange([...dates, ""])}
				>
					＋ Lisää päivä
				</Button>
			) : null}
		</div>
	);
}

/** MM-DD anchors from full YYYY-MM-DD picker values, dropping empties. */
export function toAnchors(dates: string[]): string[] {
	return dates.filter(Boolean).map((d) => d.slice(5));
}

/** Seed picker values from stored MM-DD anchors, using the given year. */
export function fromAnchors(anchors: string[], year: number): string[] {
	return anchors.map((a) => `${year}-${a}`);
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter talli typecheck && pnpm lint`
Expected: PASS. If Biome reports the `biome-ignore … noArrayIndexKey` suppression is *unused* (rule not enabled in this config), delete that comment line; if it reports `noArrayIndexKey`, keep it. Exactly one of the two will be true.

- [ ] **Step 3: Commit**

```bash
git add apps/talli/src/components/recurrence-dates-editor.tsx
git commit -m "feat(talli): recurrence dates editor component"
```

---

## Task 9: Add-bike inline-editable presets

**Files:**
- Modify: `apps/talli/src/routes/pyorat/uusi.tsx`

Replace the preset checkboxes with editable rows: each preset has a checkbox; when checked, interval presets show km/kk inputs (prefilled with catalog defaults), payment presets show the `RecurrenceDatesEditor`. The submit payload becomes the editable objects.

- [ ] **Step 1: Restructure preset state**

In `apps/talli/src/routes/pyorat/uusi.tsx`, add imports:

```ts
import { RecurrenceDatesEditor, toAnchors } from "~/components/recurrence-dates-editor";
```

and **remove** the now-unused `import { formatInterval } from "~/lib/format";` line — the old preset summary that used it is replaced in Step 3. (Keep the `PresetKey`/`REMINDER_PRESETS` imports; they're still used.)

Replace the `const [presets, setPresets] = useState<PresetKey[]>(...)` line and the `togglePreset` helper with a per-preset editable draft keyed by preset key:

```ts
	type PresetDraft = {
		checked: boolean;
		interval_km: string;
		interval_months: string;
		dates: string[]; // full YYYY-MM-DD for the picker
	};
	const [drafts, setDrafts] = useState<Record<PresetKey, PresetDraft>>(() =>
		Object.fromEntries(
			REMINDER_PRESETS.map((p) => [
				p.key,
				{
					checked: true,
					interval_km: p.type === "interval" && p.interval_km ? String(p.interval_km) : "",
					interval_months:
						p.type === "interval" && p.interval_months ? String(p.interval_months) : "",
					dates: p.type === "date" ? [""] : [],
				},
			]),
		) as Record<PresetKey, PresetDraft>,
	);

	function patchDraft(key: PresetKey, patch: Partial<PresetDraft>) {
		setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
	}
```

- [ ] **Step 2: Build the presets payload in the submit handler**

In the `createVehicle({ data: { ... } })` call, replace `presets,` with a computed list built from checked drafts:

```ts
				presets: REMINDER_PRESETS.filter((p) => drafts[p.key].checked).map((p) =>
					p.type === "interval"
						? {
								key: p.key,
								interval_km: drafts[p.key].interval_km ? Number(drafts[p.key].interval_km) : null,
								interval_months: drafts[p.key].interval_months
									? Number(drafts[p.key].interval_months)
									: null,
							}
						: { key: p.key, recurrence_dates: toAnchors(drafts[p.key].dates) },
				),
```

- [ ] **Step 3: Replace the preset `<fieldset>` markup**

Replace the preset list markup (the `<div className="mt-3 grid gap-2">…</div>` mapping `REMINDER_PRESETS`) with editable rows:

```tsx
				<div className="mt-3 grid gap-3">
					{REMINDER_PRESETS.map((p) => {
						const draft = drafts[p.key];
						return (
							<div key={p.key} className="rounded-lg border border-border p-3">
								<label className="flex items-center gap-2 text-sm font-medium">
									<input
										type="checkbox"
										data-testid={`preset-${p.key}`}
										checked={draft.checked}
										onChange={(e) => patchDraft(p.key, { checked: e.target.checked })}
									/>
									{p.title}
								</label>
								{draft.checked && p.type === "interval" ? (
									<div className="mt-2 grid grid-cols-2 gap-2">
										<label className="grid gap-1 text-xs text-muted">
											Km-väli
											<Input
												type="number"
												min={1}
												max={200_000}
												data-testid={`preset-${p.key}-km`}
												value={draft.interval_km}
												onChange={(e) => patchDraft(p.key, { interval_km: e.target.value })}
											/>
										</label>
										<label className="grid gap-1 text-xs text-muted">
											Kk-väli
											<Input
												type="number"
												min={1}
												max={120}
												data-testid={`preset-${p.key}-months`}
												value={draft.interval_months}
												onChange={(e) => patchDraft(p.key, { interval_months: e.target.value })}
											/>
										</label>
									</div>
								) : null}
								{draft.checked && p.type === "date" ? (
									<div className="mt-2">
										<p className="mb-1 text-xs text-muted">Eräpäivä(t) — voit lisätä toisen erän</p>
										<RecurrenceDatesEditor
											dates={draft.dates}
											onChange={(dates) => patchDraft(p.key, { dates })}
										/>
									</div>
								) : null}
							</div>
						);
					})}
				</div>
```

- [ ] **Step 4: Typecheck + lint + build**

Run: `pnpm --filter talli typecheck && pnpm lint && pnpm --filter talli build`
Expected: PASS. (Build also confirms no `node:*`/pg leak into the client chunk.)

- [ ] **Step 5: Manual smoke test**

Run: `pnpm --filter talli dev` (with `docker compose up -d db` and both migrations applied). Log in via motori, go to `/pyorat/uusi`. Verify: interval presets show editable km/kk prefilled; payment presets show a date picker with "＋ Lisää päivä"; adding a bike with an edited öljynvaihto interval and a vakuutus date succeeds and the detail page shows both reminders with correct due dates.

- [ ] **Step 6: Commit**

```bash
git add apps/talli/src/routes/pyorat/uusi.tsx
git commit -m "feat(talli): inline-editable preset reminders on add-bike"
```

---

## Task 10: "Merkitse maksetuksi" on the detail page

**Files:**
- Modify: `apps/talli/src/routes/pyorat/$vehicleId.tsx` (reminder rows)

Payment reminders (`recurrence_dates != null`) get a one-tap mark-paid button instead of the "Merkitse tehdyksi → service form" link.

- [ ] **Step 1: Wire the server fn + submit hook**

In `apps/talli/src/routes/pyorat/$vehicleId.tsx`, add:

```ts
import { getVehicleDetail, updateOdometer } from "~/lib/vehicles";
import { markReminderPaid } from "~/lib/reminders";
```

The component already has `const { saving, submit } = useSubmit()` and `router`. Add a handler:

```ts
	async function handlePaid(id: string) {
		await submit(async () => {
			await markReminderPaid({ data: { id } });
			router.invalidate();
		});
	}
```

- [ ] **Step 2: Branch the reminder row action**

In the reminders `.map((r) => ...)`, replace the `<Button asChild ...><Link ... >Merkitse tehdyksi</Link></Button>` with a conditional:

```tsx
								{r.recurrence_dates ? (
									<Button
										size="sm"
										variant="outline"
										data-testid={`mark-paid-${r.title}`}
										disabled={saving}
										onClick={() => handlePaid(r.id)}
									>
										Merkitse maksetuksi
									</Button>
								) : (
									<Button asChild size="sm" variant="outline">
										<Link
											to="/pyorat/$vehicleId/huolto/uusi"
											params={{ vehicleId: vehicle.id }}
											search={{ reminder: r.id }}
											data-testid={`complete-reminder-${r.title}`}
										>
											Merkitse tehdyksi
										</Link>
									</Button>
								)}
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `pnpm --filter talli typecheck && pnpm lint && pnpm --filter talli build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

In dev, on a vehicle with a payment reminder: click "Merkitse maksetuksi", confirm the due date advances to the next anchor (or +1yr for a single date) and the reminder is no longer overdue.

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/routes/pyorat/$vehicleId.tsx
git commit -m "feat(talli): one-tap mark-paid for payment reminders"
```

---

## Task 11: Edit payment reminder dates on the muistutukset page

**Files:**
- Modify: `apps/talli/src/routes/pyorat/$vehicleId_.muistutukset.tsx`

Add an inline edit affordance for payment reminders only (wiring the existing `updateReminder`), so anchor dates can be corrected after creation.

- [ ] **Step 1: Wire imports + edit state**

In `apps/talli/src/routes/pyorat/$vehicleId_.muistutukset.tsx`, add:

```ts
import { RecurrenceDatesEditor, fromAnchors, toAnchors } from "~/components/recurrence-dates-editor";
import { createReminder, deleteReminder, updateReminder } from "~/lib/reminders";
```

Add state + handlers in the component (it already has `const { saving, submit } = useSubmit()` and `router`):

```ts
	const [editing, setEditing] = useState<{ id: string; title: string; dates: string[] } | null>(
		null,
	);

	function startEdit(r: { id: string; title: string; recurrence_dates: string[] | null }) {
		const year = new Date().getFullYear();
		setEditing({ id: r.id, title: r.title, dates: fromAnchors(r.recurrence_dates ?? [], year) });
	}

	async function saveEdit() {
		if (!editing) return;
		const target = editing;
		await submit(async () => {
			await updateReminder({
				data: {
					id: target.id,
					data: {
						vehicle_id: vehicle.id,
						type: "date",
						title: target.title,
						recurrence_dates: toAnchors(target.dates),
					},
				},
			});
			setEditing(null);
			router.invalidate();
		});
	}
```

- [ ] **Step 2: Add the edit button + inline editor to payment reminder rows**

In the reminder row `.map`, for rows where `r.recurrence_dates` is set, render an "Muokkaa" button next to "Poista", and below the row render the editor when `editing?.id === r.id`:

```tsx
							{r.recurrence_dates ? (
								<Button
									size="sm"
									variant="ghost"
									data-testid="edit-reminder"
									onClick={() => startEdit(r)}
								>
									Muokkaa
								</Button>
							) : null}
```

and, inside the `<li>` (after the row content), when editing this reminder:

```tsx
							{editing?.id === r.id ? (
								<div className="mt-3 border-t border-border pt-3">
									<RecurrenceDatesEditor
										dates={editing.dates}
										onChange={(dates) => setEditing({ ...editing, dates })}
									/>
									<div className="mt-2 flex gap-2">
										<Button size="sm" disabled={saving} data-testid="save-reminder" onClick={saveEdit}>
											Tallenna
										</Button>
										<Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
											Peruuta
										</Button>
									</div>
								</div>
							) : null}
```

- [ ] **Step 3: Typecheck + lint + build**

Run: `pnpm --filter talli typecheck && pnpm lint && pnpm --filter talli build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

In dev, on the muistutukset page: a payment reminder shows "Muokkaa"; editing a date and saving updates it (verify the detail page due date reflects the new anchor). Interval/plain-date reminders show no edit button (unchanged).

- [ ] **Step 5: Commit**

```bash
git add apps/talli/src/routes/pyorat/$vehicleId_.muistutukset.tsx
git commit -m "feat(talli): edit payment reminder dates"
```

---

## Task 12: Full gate + e2e extension

**Files:**
- Modify: `apps/talli/e2e/tests/talli-happy-path.spec.ts` (extend happy path)

- [ ] **Step 1: Extend the e2e happy path**

In the existing happy-path spec, after adding a vehicle, add assertions that a payment preset date can be set at creation and marked paid. Follow the file's existing selectors and `data-hydrated` wait; use the new testids: `preset-vakuutus`, `recurrence-date-0`, `mark-paid-Vakuutus`. Add a step that fills `recurrence-date-0` with a future date before submitting the vehicle form, then on the detail page clicks `mark-paid-Vakuutus` and asserts the reminder row no longer shows overdue. (Match the assertion style already in the file.)

- [ ] **Step 2: Run the full local gate**

Run each, expecting PASS:

```bash
pnpm -r typecheck
pnpm lint
pnpm -r test
pnpm --filter motori build
DEPLOY_APP=talli pnpm build
```

- [ ] **Step 3: Verify client bundle is clean**

Run: `grep -l "node:fs\|AsyncLocalStorage\|from\"kysely\"" apps/talli/.output/public/assets/*.js`
Expected: no output (clean).

- [ ] **Step 4: Run the talli e2e**

Run: `docker compose up -d db && pnpm db:migrate && pnpm --filter talli db:migrate && pnpm test:e2e:talli`
Expected: PASS (dual-server SSO happy path incl. the new payment steps).

- [ ] **Step 5: Commit**

```bash
git add apps/talli/e2e/tests/talli-happy-path.spec.ts
git commit -m "test(talli): e2e covers payment reminder create + mark-paid"
```

---

## Self-Review Notes

- **Spec coverage:** recurrence_dates column (T1) · nextRecurrence (T2) · reanchor branch (T3) · validators incl. editable presets (T4) · due_date-from-anchors on create/update (T5) · one-tap markReminderPaid, no service record (T6) · createVehicle editable presets + getVehicleDetail select (T7) · shared date editor (T8) · inline-editable add-bike presets (T9) · "Merkitse maksetuksi" (T10) · edit payment dates via updateReminder (T11) · nextRecurrence unit tests + e2e (T2/T3/T12). All spec bullets mapped.
- **Discriminator** is `recurrence_dates != null` everywhere (server + both UIs).
- **Out of scope (per spec):** paid-amount logging, payment-history records, manual-form creation of recurring payment reminders (presets cover creation), auto-detecting real Traficom dates.
- **Type consistency:** `reanchorOnComplete` takes `{ type, due_date, recurrence_dates }` in T3/T6; `reminderTypeColumns(data, anchor, today)` signature is consistent T5/T7-callers; `toAnchors`/`fromAnchors` names consistent T8/T9/T11.
