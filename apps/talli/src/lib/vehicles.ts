import { createServerFn } from "@tanstack/react-start";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { REMINDER_PRESETS } from "~/lib/constants";
import type { Database, NewReminder, Vehicle } from "~/lib/db/schema";
import { computeDueState, type DueState } from "~/lib/due-state";
import { AppError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { recordOdometerReading } from "~/lib/odometer";
import { getSession } from "~/lib/session";
import { isValidImageUrl, vehicleFormSchema } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

function requireUserId(session: Awaited<ReturnType<typeof getSession>>): string {
	if (!session) {
		throw new AppError("Kirjaudu sisään");
	}
	return session.user.id;
}

/** Ownership gate — every vehicle/record/reminder mutation goes through this. */
export async function getOwnedVehicle(
	db: Kysely<Database> | Transaction<Database>,
	vehicleId: string,
	userId: string,
): Promise<Vehicle> {
	const vehicle = await db
		.selectFrom("talli.vehicle")
		.selectAll()
		.where("id", "=", vehicleId)
		.executeTakeFirst();
	if (!vehicle || vehicle.user_id !== userId) {
		throw new AppError("Pyörää ei löytynyt");
	}
	return vehicle;
}

function validatePhotoUrls(data: { photo_url?: string | null; thumbnail_url?: string | null }) {
	for (const url of [data.photo_url, data.thumbnail_url]) {
		if (url && !isValidImageUrl(url)) {
			throw new AppError("Virheellinen kuva-URL");
		}
	}
}

export const createVehicle = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-vehicle-create", 10, 3600))
	.inputValidator(vehicleFormSchema)
	.handler(async ({ data }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		validatePhotoUrls(data);

		const today = new Date().toISOString().slice(0, 10);

		const vehicleId = await db.transaction().execute(async (trx) => {
			const vehicle = await trx
				.insertInto("talli.vehicle")
				.values({
					user_id: userId,
					make: data.make,
					model: data.model,
					year: data.year ?? null,
					nickname: data.nickname ?? null,
					plate: data.plate ?? null,
					vin: data.vin ?? null,
					photo_url: data.photo_url ?? null,
					thumbnail_url: data.thumbnail_url ?? null,
					odometer_km: data.odometer_km,
				})
				.returning("id")
				.executeTakeFirstOrThrow();

			await trx
				.insertInto("talli.odometer_entry")
				.values({ vehicle_id: vehicle.id, reading_km: data.odometer_km })
				.execute();

			// One-tap presets: interval reminders anchor to now + current odometer;
			// date presets default to +1 year (editable in muistutukset).
			const presets = REMINDER_PRESETS.filter((p) => data.presets.includes(p.key));
			if (presets.length > 0) {
				const inYear = new Date();
				inYear.setFullYear(inYear.getFullYear() + 1);
				const rows: NewReminder[] = presets.map((p) =>
					p.type === "interval"
						? {
								vehicle_id: vehicle.id,
								type: "interval" as const,
								title: p.title,
								interval_km: p.interval_km,
								interval_months: p.interval_months,
								last_done_at: today,
								last_done_km: data.odometer_km,
								due_date: null,
								notified_at: null,
							}
						: {
								vehicle_id: vehicle.id,
								type: "date" as const,
								title: p.title,
								interval_km: null,
								interval_months: null,
								last_done_at: null,
								last_done_km: null,
								due_date: inYear.toISOString().slice(0, 10),
								notified_at: null,
							},
				);
				await trx.insertInto("talli.reminder").values(rows).execute();
			}

			return vehicle.id;
		});

		log.event(EVENTS.vehicle.created, { vehicleId, presets: data.presets });
		return { id: vehicleId };
	});

export const updateVehicle = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-vehicle-update", 20, 3600))
	.inputValidator((input: { id: string; data: unknown }) => {
		const parsed = z.string().uuid().parse(input.id);
		return { id: parsed, data: vehicleFormSchema.omit({ presets: true }).parse(input.data) };
	})
	.handler(async ({ data: { id, data } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		validatePhotoUrls(data);

		await db.transaction().execute(async (trx) => {
			const vehicle = await getOwnedVehicle(trx, id, userId);
			await trx
				.updateTable("talli.vehicle")
				.set({
					make: data.make,
					model: data.model,
					year: data.year ?? null,
					nickname: data.nickname ?? null,
					plate: data.plate ?? null,
					vin: data.vin ?? null,
					photo_url: data.photo_url ?? null,
					thumbnail_url: data.thumbnail_url ?? null,
					updated_at: new Date(),
				})
				.where("id", "=", vehicle.id)
				.execute();
			if (data.odometer_km !== vehicle.odometer_km) {
				await recordOdometerReading(trx, vehicle, data.odometer_km);
			}
		});

		log.event(EVENTS.vehicle.updated, { vehicleId: id });
	});

export const deleteVehicle = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-vehicle-delete", 10, 3600))
	.inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
	.handler(async ({ data: { id } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		await getOwnedVehicle(db, id, userId);
		await db.deleteFrom("talli.vehicle").where("id", "=", id).execute();
		log.event(EVENTS.vehicle.deleted, { vehicleId: id });
	});

export const updateOdometer = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-odometer", 30, 3600))
	.inputValidator((input: { vehicle_id: string; reading_km: number }) => ({
		vehicle_id: z.string().uuid().parse(input.vehicle_id),
		reading_km: z.number().int().min(0).max(2_000_000).parse(input.reading_km),
	}))
	.handler(async ({ data }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		await db.transaction().execute(async (trx) => {
			const vehicle = await getOwnedVehicle(trx, data.vehicle_id, userId);
			await recordOdometerReading(trx, vehicle, data.reading_km);
		});
		log.event(EVENTS.odometer.updated, { vehicleId: data.vehicle_id, readingKm: data.reading_km });
	});

// ─── Queries ─────────────────────────────────────────────────────────────────

export interface GarageVehicle extends Vehicle {
	nextDue: { title: string; state: DueState } | null;
}

export const getGarage = createServerFn().handler(async (): Promise<GarageVehicle[]> => {
	const session = await getSession();
	if (!session) {
		return [];
	}
	const db = await getDb();
	const { sql } = await import("kysely");

	const vehicles = await db
		.selectFrom("talli.vehicle")
		.selectAll()
		.where("user_id", "=", session.user.id)
		.orderBy("created_at", "asc")
		.execute();

	if (vehicles.length === 0) {
		return [];
	}

	const reminders = await db
		.selectFrom("talli.reminder")
		.select([
			"id",
			"vehicle_id",
			"type",
			"title",
			"interval_km",
			"interval_months",
			sql<string | null>`last_done_at::text`.as("last_done_at"),
			"last_done_km",
			sql<string | null>`due_date::text`.as("due_date"),
		])
		.where(
			"vehicle_id",
			"in",
			vehicles.map((v) => v.id),
		)
		.execute();

	return vehicles.map((v) => {
		const states = reminders
			.filter((r) => r.vehicle_id === v.id)
			.map((r) => ({ title: r.title, state: computeDueState(r, v.odometer_km) }));
		// Worst status first: overdue > due_soon > ok. Status is what the card shows;
		// the within-status tie-break is a rough nudge (km and days aren't the same
		// unit, so no exact cross-reminder ordering is meaningful for the MVP card).
		const rank = { overdue: 0, due_soon: 1, ok: 2 } as const;
		states.sort(
			(a, b) =>
				rank[a.state.status] - rank[b.state.status] ||
				(a.state.dueInDays ?? a.state.dueInKm ?? 0) - (b.state.dueInDays ?? b.state.dueInKm ?? 0),
		);
		return { ...v, nextDue: states[0] ?? null };
	});
});
