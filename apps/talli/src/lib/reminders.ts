import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nextRecurrence, reanchorOnComplete } from "~/lib/due-state";
import { TalliError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { getSession, requireUserId } from "~/lib/session";
import { type ReminderFormData, reminderFormSchema } from "~/lib/validators";
import { getOwnedVehicle } from "~/lib/vehicles";

const getDb = async () => (await import("~/lib/db/index")).db;

// Null out cross-type fields so the DB CHECK constraints hold: an interval
// reminder never carries a due_date, and a date reminder never carries
// interval thresholds. `anchor` backfills the interval's last-done point when
// the user didn't supply one (now + current odometer on create, null on edit).
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

export const createReminder = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-reminder-create", 30, 3600))
	.inputValidator(reminderFormSchema)
	.handler(async ({ data }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();

		const id = await db.transaction().execute(async (trx) => {
			const vehicle = await getOwnedVehicle(trx, data.vehicle_id, userId);
			// Interval reminders anchor to now + current odometer unless the user
			// backfilled when it was last done.
			const today = new Date().toISOString().slice(0, 10);
			const row = await trx
				.insertInto("talli.reminder")
				.values({
					vehicle_id: vehicle.id,
					type: data.type,
					title: data.title,
					...reminderTypeColumns(
						data,
						{ last_done_at: today, last_done_km: vehicle.odometer_km },
						today,
					),
					notified_at: null,
				})
				.returning("id")
				.executeTakeFirstOrThrow();
			return row.id;
		});

		log.event(EVENTS.reminder.created, { reminderId: id, type: data.type });
		return { id };
	});

export const updateReminder = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-reminder-update", 30, 3600))
	.inputValidator((input: { id: string; data: unknown }) => ({
		id: z.string().uuid().parse(input.id),
		data: reminderFormSchema.parse(input.data),
	}))
	.handler(async ({ data: { id, data } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		const { sql } = await import("kysely");

		await db.transaction().execute(async (trx) => {
			// data.vehicle_id is intentionally ignored on update — a reminder can't be
			// reparented; ownership is enforced via the reminder's existing vehicle.
			const reminder = await trx
				.selectFrom("talli.reminder")
				.select([
					"id",
					"vehicle_id",
					sql<string | null>`last_done_at::text`.as("last_done_at"),
					"last_done_km",
				])
				.where("id", "=", id)
				.executeTakeFirst();
			if (!reminder) {
				throw new TalliError("Muistutusta ei löytynyt");
			}
			const vehicle = await getOwnedVehicle(trx, reminder.vehicle_id, userId);
			// Preserve the existing interval anchor across edits that don't resend it;
			// fall back to today + current odometer for a date→interval switch (its
			// anchors are null) so an interval reminder always has a valid anchor.
			const today = new Date().toISOString().slice(0, 10);
			const anchor = {
				last_done_at: reminder.last_done_at ?? today,
				last_done_km: reminder.last_done_km ?? vehicle.odometer_km,
			};
			// Editing thresholds/dates changes the due cycle — clear the dedupe stamp.
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
		});

		log.event(EVENTS.reminder.updated, { reminderId: id });
	});

export const deleteReminder = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-reminder-delete", 30, 3600))
	.inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
	.handler(async ({ data: { id } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();

		await db.transaction().execute(async (trx) => {
			const reminder = await trx
				.selectFrom("talli.reminder")
				.select(["id", "vehicle_id"])
				.where("id", "=", id)
				.executeTakeFirst();
			if (!reminder) {
				throw new TalliError("Muistutusta ei löytynyt");
			}
			await getOwnedVehicle(trx, reminder.vehicle_id, userId);
			await trx.deleteFrom("talli.reminder").where("id", "=", id).execute();
		});

		log.event(EVENTS.reminder.deleted, { reminderId: id });
	});

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
			if (!reminder?.recurrence_dates?.length) {
				throw new TalliError("Muistutusta ei löytynyt");
			}
			await getOwnedVehicle(trx, reminder.vehicle_id, userId);
			const today = new Date().toISOString().slice(0, 10);
			// reanchorOnComplete advances a payment reminder to its next anchor and
			// clears notified_at — same logic as a service completion, no record.
			const update = reanchorOnComplete(
				{
					type: reminder.type,
					due_date: reminder.due_date,
					recurrence_dates: reminder.recurrence_dates,
				},
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
