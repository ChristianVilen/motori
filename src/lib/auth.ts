// src/lib/auth.ts

import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { admin } from "better-auth/plugins";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";
import { wrapEmail } from "~/lib/email-wrapper";
import { getEmailT } from "~/lib/i18n/email";
import { passwordStrength } from "~/lib/password-strength";

export const auth = betterAuth({
	database: kyselyAdapter(db, {
		type: "postgres",
	}),
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
	secret: process.env.BETTER_AUTH_SECRET,
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // refresh expiry every 24 h of activity
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		password: {
			async hash(password: string) {
				if (passwordStrength(password).score <= 1) {
					throw new Error("PASSWORD_TOO_WEAK");
				}
				return hashPassword(password);
			},
			verify: verifyPassword,
		},
		sendResetPassword: async ({ user, url }) => {
			const profile = await db
				.selectFrom("profile")
				.select("language")
				.where("user_id", "=", user.id)
				.executeTakeFirst();
			const lang = profile?.language ?? "fi";
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
		customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
			...coreFields,
			role: "user",
			banned: false,
			banReason: null,
			banExpires: null,
			...additionalFields,
			id,
		}),
	},
	plugins: [admin()],
	rateLimit: {
		enabled: process.env.NODE_ENV === "production",
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 5 },
		},
	},
	advanced: {
		ipAddress: {
			ipAddressHeaders: ["x-forwarded-for"],
		},
	},
	emailVerification: {
		expiresIn: 86400, // 24 hours
		sendVerificationEmail: async ({ user, url }) => {
			const profile = await db
				.selectFrom("profile")
				.select("language")
				.where("user_id", "=", user.id)
				.executeTakeFirst();
			const lang = profile?.language ?? "fi";
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
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
