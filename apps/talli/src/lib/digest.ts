import { sendEmail } from "@motori/server/email";
import { wrapEmail } from "@motori/server/email-wrapper";
import { sql } from "kysely";
import { SITE_URL } from "~/lib/constants";
import { computeDueState, type DueInput, type DueState } from "~/lib/due-state";
import { log, withLogContext } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

const CONCURRENCY = 5;

export interface DigestRow extends DueInput {
	id: string;
	user_id: string;
	email: string;
	email_reminders: boolean;
	vehicle_id: string;
	vehicle_label: string;
	odometer_km: number;
	title: string;
	notified_at: Date | null;
}

export interface UserDigest {
	userId: string;
	email: string;
	reminders: Array<{
		id: string;
		title: string;
		vehicleId: string;
		vehicleLabel: string;
		state: DueState;
	}>;
}

/** Pure selection: due_soon/overdue, not yet notified, email enabled — grouped per user. */
export function selectDigestReminders(rows: DigestRow[], today: Date): UserDigest[] {
	const byUser = new Map<string, UserDigest>();
	for (const row of rows) {
		if (!row.email_reminders || row.notified_at !== null) {
			continue;
		}
		const state = computeDueState(row, row.odometer_km, today);
		if (state.status === "ok") {
			continue;
		}
		let digest = byUser.get(row.user_id);
		if (!digest) {
			digest = { userId: row.user_id, email: row.email, reminders: [] };
			byUser.set(row.user_id, digest);
		}
		digest.reminders.push({
			id: row.id,
			title: row.title,
			vehicleId: row.vehicle_id,
			vehicleLabel: row.vehicle_label,
			state,
		});
	}
	return [...byUser.values()];
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) =>
		c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
	);
}

function statusLabel(state: DueState): string {
	return state.status === "overdue" ? "erääntynyt" : "erääntyy pian";
}

/** One digest email per user per day; stamps notified_at per included reminder. */
export async function sendReminderDigests(): Promise<number> {
	return withLogContext({ task: "reminder-digest" }, async () => {
		const { db } = await import("~/lib/db/index");

		const rows = (await db
			.selectFrom("talli.reminder")
			.innerJoin("talli.vehicle", "talli.vehicle.id", "talli.reminder.vehicle_id")
			.innerJoin("user", "user.id", "talli.vehicle.user_id")
			.leftJoin("talli.user_settings", "talli.user_settings.user_id", "user.id")
			.select([
				"talli.reminder.id",
				"talli.reminder.type",
				"talli.reminder.title",
				"talli.reminder.interval_km",
				"talli.reminder.interval_months",
				sql<string | null>`talli.reminder.last_done_at::text`.as("last_done_at"),
				"talli.reminder.last_done_km",
				sql<string | null>`talli.reminder.due_date::text`.as("due_date"),
				"talli.reminder.notified_at",
				"talli.vehicle.id as vehicle_id",
				"talli.vehicle.odometer_km",
				sql<string>`coalesce(talli.vehicle.nickname, talli.vehicle.make || ' ' || talli.vehicle.model)`.as(
					"vehicle_label",
				),
				"user.id as user_id",
				"user.email",
				sql<boolean>`coalesce(talli.user_settings.email_reminders, true)`.as("email_reminders"),
			])
			.where("talli.reminder.notified_at", "is", null)
			.execute()) as unknown as DigestRow[];

		const digests = selectDigestReminders(rows, new Date());
		let sent = 0;

		for (let i = 0; i < digests.length; i += CONCURRENCY) {
			const batch = digests.slice(i, i + CONCURRENCY);
			const results = await Promise.allSettled(
				batch.map(async (digest) => {
					const items = digest.reminders
						.map(
							(r) =>
								`<li><a href="${SITE_URL}/pyorat/${r.vehicleId}">${escapeHtml(r.vehicleLabel)}</a>: ${escapeHtml(r.title)} — ${statusLabel(r.state)}</li>`,
						)
						.join("");
					const textItems = digest.reminders
						.map((r) => `- ${r.vehicleLabel}: ${r.title} — ${statusLabel(r.state)}`)
						.join("\n");
					const reminderKey = digest.reminders
						.map((r) => r.id)
						.sort()
						.join("-");

					await sendEmail({
						to: digest.email,
						subject: "Talli: huoltomuistutuksia",
						html: wrapEmail(
							`
							<p>Hei,</p>
							<p>Seuraavat huollot ovat erääntymässä tai erääntyneet:</p>
							<ul>${items}</ul>
							<p><a href="${SITE_URL}">Avaa Talli</a> — muista päivittää mittarilukema.</p>
						`,
							"fi",
						),
						text: `Seuraavat huollot ovat erääntymässä tai erääntyneet:\n\n${textItems}\n\n${SITE_URL}`,
						idempotencyKey: `talli-digest/${digest.userId}/${reminderKey}`,
					});

					await db
						.updateTable("talli.reminder")
						.set({ notified_at: new Date(), updated_at: new Date() })
						.where(
							"id",
							"in",
							digest.reminders.map((r) => r.id),
						)
						.execute();

					log.event(EVENTS.digest.sent, {
						userId: digest.userId,
						reminders: digest.reminders.length,
					});
					sent++;
				}),
			);

			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				if (result.status === "rejected") {
					log.event(EVENTS.digest.send_failed, { userId: batch[j].userId, err: result.reason });
				}
			}
		}

		return sent;
	});
}
