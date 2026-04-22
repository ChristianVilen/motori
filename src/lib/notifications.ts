import { sql } from "kysely";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";
import { createI18nSync } from "~/lib/i18n/server";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";

const i18n = createI18nSync("fi");
const t = i18n.getFixedT("fi", "email");

/** Send expiry warning emails for listings expiring within `daysAhead` days. */
export async function sendListingExpiryWarnings(daysAhead = 7): Promise<number> {
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
		.where("listing.expires_at", "<=", sql<Date>`now() + ${sql.lit(`${daysAhead} days`)}::interval`)
		.where("listing.expires_at", ">", sql<Date>`now()`)
		.execute();

	let sent = 0;
	for (const row of rows) {
		if (!row.expires_at) {
			continue;
		}
		const daysLeft = Math.ceil((row.expires_at.getTime() - Date.now()) / 86_400_000);
		try {
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
			});
			log.event(EVENTS.notification.expiry_warning_sent, { listingId: row.id, daysLeft });
			sent++;
		} catch {
			log.event(EVENTS.notification.expiry_warning_skipped, {
				listingId: row.id,
				reason: "send_failed",
			});
		}
	}
	return sent;
}
