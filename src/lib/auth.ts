// src/lib/auth.ts

import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";
import { emailT as t } from "~/lib/i18n/email";

export const auth = betterAuth({
	database: kyselyAdapter(db, {
		type: "postgres",
	}),
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	secret: process.env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		sendResetPassword: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: t("passwordReset.subject"),
				html: `
					<p>${t("passwordReset.greeting")}</p>
					<p>${t("passwordReset.body")}</p>
					<p><a href="${url}">${url}</a></p>
					<p>${t("passwordReset.expiry")}</p>
					<p>${t("signature")}</p>
				`,
				text: `${t("passwordReset.body")}\n${url}\n\n${t("passwordReset.expiry")}`,
			});
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
			void sendEmail({
				to: user.email,
				subject: t("verification.subject"),
				html: `
					<p>${t("verification.greeting")}</p>
					<p>${t("verification.body")}</p>
					<p><a href="${url}">${url}</a></p>
					<p>${t("verification.expiry")}</p>
					<p>${t("signature")}</p>
				`,
				text: `${t("verification.body")}\n${url}\n\n${t("verification.expiry")}`,
			});
		},
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
