// src/lib/auth.ts

import { createAuth } from "@motori/server/auth";
import { sendEmail } from "@motori/server/email";
import { wrapEmail } from "@motori/server/email-wrapper";
import { db } from "~/lib/db/index";
import { getEmailT } from "~/lib/i18n/email";

async function langFor(userId: string): Promise<"fi" | "en"> {
	const profile = await db
		.selectFrom("profile")
		.select("language")
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return profile?.language ?? "fi";
}

export const auth = createAuth({
	db,
	sendResetPassword: async ({ user, url }) => {
		const lang = await langFor(user.id);
		const t = getEmailT(lang);
		void sendEmail({
			to: user.email,
			subject: t("passwordReset.subject"),
			html: wrapEmail(
				`
				<p>${t("passwordReset.greeting")}</p>
				<p>${t("passwordReset.body")}</p>
				<p><a href="${url.replace(/&/g, "&amp;")}">${url.replace(/&/g, "&amp;")}</a></p>
				<p>${t("passwordReset.expiry")}</p>
			`,
				lang,
			),
			text: `${t("passwordReset.body")}\n${url}\n\n${t("passwordReset.expiry")}`,
		}).catch(() => {});
	},
	sendVerificationEmail: async ({ user, url }) => {
		const lang = await langFor(user.id);
		const t = getEmailT(lang);
		void sendEmail({
			to: user.email,
			subject: t("verification.subject"),
			html: wrapEmail(
				`
				<p>${t("verification.greeting")}</p>
				<p>${t("verification.body")}</p>
				<p><a href="${url.replace(/&/g, "&amp;")}">${url.replace(/&/g, "&amp;")}</a></p>
				<p>${t("verification.expiry")}</p>
			`,
				lang,
			),
			text: `${t("verification.body")}\n${url}\n\n${t("verification.expiry")}`,
		}).catch(() => {});
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
