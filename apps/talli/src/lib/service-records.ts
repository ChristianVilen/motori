import { createServerFn } from "@tanstack/react-start";
import type { Transaction } from "kysely";
import type { Database } from "~/lib/db/schema";
import { reanchorOnComplete } from "~/lib/due-state";
import { TalliError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { recordOdometerReading } from "~/lib/odometer";
import { getSession } from "~/lib/session";
import { eurosToCents, isValidImageUrl, serviceRecordFormSchema } from "~/lib/validators";
import { getOwnedVehicle } from "~/lib/vehicles";

const getDb = async () => (await import("~/lib/db/index")).db;

/**
 * Re-anchor the reminder this service record completes. IDOR: the reminder must
 * belong to the same (already ownership-checked) vehicle. Re-anchor writes
 * interval → last_done_*; date → due_date + 1 year, and clears notified_at.
 */
async function completeReminder(
	trx: Transaction<Database>,
	reminderId: string,
	vehicleId: string,
	performedAt: string,
	odometerKm: number | null,
): Promise<void> {
	const { sql } = await import("kysely");
	const reminder = await trx
		.selectFrom("talli.reminder")
		.select([
			"id",
			"vehicle_id",
			"type",
			sql<string | null>`due_date::text`.as("due_date"),
			"recurrence_dates",
		])
		.where("id", "=", reminderId)
		.executeTakeFirst();
	if (!reminder || reminder.vehicle_id !== vehicleId) {
		throw new TalliError("Muistutusta ei löytynyt");
	}
	const update = reanchorOnComplete(
		{
			type: reminder.type,
			due_date: reminder.due_date,
			recurrence_dates: reminder.recurrence_dates,
		},
		performedAt,
		odometerKm,
	);
	await trx
		.updateTable("talli.reminder")
		.set({ ...update, updated_at: new Date() })
		.where("id", "=", reminder.id)
		.execute();
}

export const createServiceRecord = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-service-create", 30, 3600))
	.inputValidator(serviceRecordFormSchema)
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new TalliError("Kirjaudu sisään");
		}
		const db = await getDb();

		for (const photo of data.photos) {
			if (!isValidImageUrl(photo.url) || !isValidImageUrl(photo.thumbnail_url)) {
				throw new TalliError("Virheellinen kuva-URL");
			}
		}

		const recordId = await db.transaction().execute(async (trx) => {
			const vehicle = await getOwnedVehicle(trx, data.vehicle_id, session.user.id);

			// Completing a reminder? Re-anchor it (IDOR-checked against this vehicle).
			if (data.reminder_id) {
				// Interval reminders must never re-anchor to a null km, or km-based due
				// tracking dies (kmRemaining returns null forever). Completing "now"
				// means "at current mileage" — fall back to the vehicle's odometer.
				await completeReminder(
					trx,
					data.reminder_id,
					vehicle.id,
					data.performed_at,
					data.odometer_km ?? vehicle.odometer_km,
				);
			}

			const record = await trx
				.insertInto("talli.service_record")
				.values({
					vehicle_id: vehicle.id,
					reminder_id: data.reminder_id ?? null,
					performed_at: data.performed_at,
					odometer_km: data.odometer_km ?? null,
					title: data.title,
					notes: data.notes ?? null,
					cost_cents: data.cost_eur != null ? eurosToCents(data.cost_eur) : null,
					parts: data.parts ?? null,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			if (data.photos.length > 0) {
				await trx
					.insertInto("talli.service_record_photo")
					.values(
						data.photos.map((p, i) => ({
							service_record_id: record.id,
							url: p.url,
							thumbnail_url: p.thumbnail_url,
							position: i,
						})),
					)
					.execute();
			}

			if (data.odometer_km != null) {
				await recordOdometerReading(trx, vehicle, data.odometer_km);
			}

			return record.id;
		});

		log.event(EVENTS.service_record.created, {
			recordId,
			vehicleId: data.vehicle_id,
			completedReminder: data.reminder_id ?? undefined,
		});
		if (data.reminder_id) {
			log.event(EVENTS.reminder.completed, { reminderId: data.reminder_id, recordId });
		}
		return { id: recordId };
	});
