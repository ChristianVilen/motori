// src/lib/auth.ts

import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { betterAuth } from "better-auth";
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
		requireEmailVerification: process.env.DISABLE_EMAIL_VERIFICATION !== "true",
	},
	rateLimit: {
		enabled: true,
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/email": { window: 10, max: 3 },
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
			await sendEmail({
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
