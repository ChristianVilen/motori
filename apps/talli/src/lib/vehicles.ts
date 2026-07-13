import { createServerFn } from "@tanstack/react-start";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { REMINDER_PRESETS } from "~/lib/constants";
import type { Database, NewReminder, Vehicle } from "~/lib/db/schema";
import { computeDueState, type DueState, nextRecurrence } from "~/lib/due-state";
import { TalliError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { recordOdometerReading } from "~/lib/odometer";
import { getSession, requireUserId } from "~/lib/session";
import { isValidImageUrl, vehicleCreateSchema, vehicleFormSchema } from "~/lib/validators";

const getDb = async () => (await import("~/lib/db/index")).db;

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
		throw new TalliError("Pyörää ei löytynyt");
	}
	return vehicle;
}

function validatePhotoUrls(data: { photo_url?: string | null; thumbnail_url?: string | null }) {
	for (const url of [data.photo_url, data.thumbnail_url]) {
		if (url && !isValidImageUrl(url)) {
			throw new TalliError("Virheellinen kuva-URL");
		}
	}
}

export const createVehicle = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-vehicle-create", 10, 3600))
	.inputValidator(vehicleCreateSchema)
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

			return vehicle.id;
		});

		log.event(EVENTS.vehicle.created, { vehicleId, presets: data.presets.map((p) => p.key) });
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

export const getVehicleDetail = createServerFn()
	.inputValidator((input: { vehicleId: string }) => ({
		vehicleId: z.string().uuid().parse(input.vehicleId),
	}))
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new TalliError("Kirjaudu sisään");
		}
		const db = await getDb();
		const { sql } = await import("kysely");

		const vehicle = await getOwnedVehicle(db, data.vehicleId, session.user.id);

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
				"recurrence_dates",
			])
			.where("vehicle_id", "=", vehicle.id)
			.orderBy("created_at", "asc")
			.execute();

		const records = await db
			.selectFrom("talli.service_record")
			.select([
				"id",
				"reminder_id",
				sql<string>`performed_at::text`.as("performed_at"),
				"odometer_km",
				"title",
				"notes",
				"cost_cents",
				"parts",
			])
			.where("vehicle_id", "=", vehicle.id)
			.orderBy("performed_at", "desc")
			.orderBy("created_at", "desc")
			.execute();

		const photos = records.length
			? await db
					.selectFrom("talli.service_record_photo")
					.selectAll()
					.where(
						"service_record_id",
						"in",
						records.map((r) => r.id),
					)
					.orderBy("position", "asc")
					.execute()
			: [];

		return {
			vehicle,
			reminders: reminders.map((r) => ({ ...r, state: computeDueState(r, vehicle.odometer_km) })),
			records: records.map((r) => ({
				...r,
				photos: photos.filter((p) => p.service_record_id === r.id),
			})),
		};
	});
