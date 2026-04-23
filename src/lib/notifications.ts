import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";
import { emailT as t } from "~/lib/i18n/email";
import { log, withLogContext } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

const CONCURRENCY = 5;

/** Send expiry warning emails for listings expiring within `daysAhead` days. */
export async function sendListingExpiryWarnings(daysAhead = 7): Promise<number> {
	return withLogContext({ task: "expiry-warnings" }, async () => {
		const rows = await db
			.selectFrom("listing")
			.innerJoin("user", "user.id", "listing.owner_id")
			.innerJoin("profile", "profile.user_id", "listing.owner_id")
			.select([
				"listing.id",
				"listing.title",
				"listing.expires_at",
				"user.email",
				"profile.display_name",
			])
			.where("listing.status", "=", "active")
			.where("listing.expires_at", "is not", null)
			.where("listing.expires_at", "<=", sql<Date>`now() + make_interval(days => ${daysAhead})`)
			.where("listing.expires_at", ">", sql<Date>`now()`)
			.where("listing.expiry_notified_at", "is", null)
			.execute();

		let sent = 0;

		for (let i = 0; i < rows.length; i += CONCURRENCY) {
			const batch = rows.slice(i, i + CONCURRENCY);
			const results = await Promise.allSettled(
				batch.map(async (row) => {
					if (!row.expires_at) {
						return;
					}
					const daysLeft = Math.ceil((row.expires_at.getTime() - Date.now()) / 86_400_000);
					await sendEmail({
						to: row.email,
						subject: t("listingExpiry.subject"),
						html: `
							<p>${t("listingExpiry.greeting", { name: row.display_name })}</p>
							<p>${t("listingExpiry.body", { title: row.title, days: daysLeft })}</p>
							<p>${t("listingExpiry.cta")}</p>
							<p>${t("signature")}</p>
						`,
						text: `${t("listingExpiry.body", { title: row.title, days: daysLeft })}\n\n${t("listingExpiry.cta")}`,
						idempotencyKey: `expiry-warning/${row.id}`,
					});
					await db
						.updateTable("listing")
						.set({ expiry_notified_at: new Date(), updated_at: new Date() })
						.where("id", "=", row.id)
						.execute();
					log.event(EVENTS.notification.expiry_warning_sent, {
						listingId: row.id,
						daysLeft,
					});
					sent++;
				}),
			);

			for (let j = 0; j < results.length; j++) {
				const result = results[j];
				if (result.status === "rejected") {
					const row = batch[j];
					log.event(EVENTS.notification.expiry_warning_skipped, {
						listingId: row.id,
						reason: "send_failed",
						err: result.reason,
					});
				}
			}
		}

		return sent;
	});
}
