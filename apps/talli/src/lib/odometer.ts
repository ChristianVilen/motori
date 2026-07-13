import type { Kysely, Transaction } from "kysely";
import type { Database } from "~/lib/db/schema";

/** Every reading is recorded; the denormalized vehicle odometer only moves forward. */
export function applyOdometerReading(currentKm: number, readingKm: number): number {
	return Math.max(currentKm, readingKm);
}

/**
 * Shared by every place the user enters a km reading (manual update, service
 * record). Runs inside the caller's transaction.
 */
export async function recordOdometerReading(
	trx: Transaction<Database> | Kysely<Database>,
	vehicle: { id: string; odometer_km: number },
	readingKm: number,
): Promise<void> {
	const newOdometerKm = applyOdometerReading(vehicle.odometer_km, readingKm);
	await trx
		.insertInto("talli.odometer_entry")
		.values({ vehicle_id: vehicle.id, reading_km: readingKm })
		.execute();
	if (newOdometerKm !== vehicle.odometer_km) {
		await trx
			.updateTable("talli.vehicle")
			.set({ odometer_km: newOdometerKm, updated_at: new Date() })
			.where("id", "=", vehicle.id)
			.execute();
	}
}
