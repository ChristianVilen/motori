// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { db } from "~/lib/db/index";
import { sendEmail } from "~/lib/email";

export const auth = betterAuth({
	database: kyselyAdapter(db, {
		type: "postgres",
	}),
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	secret: process.env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
	},
	emailVerification: {
		expiresIn: 86400, // 24 hours — matches the Finnish email copy
		sendVerificationEmail: async ({ user, url }) => {
			await sendEmail({
				to: user.email,
				subject: "Vahvista sähköpostiosoitteesi — Vuokramoto",
				html: `
					<p>Hei,</p>
					<p>Vahvista sähköpostiosoitteesi klikkaamalla alla olevaa linkkiä:</p>
					<p><a href="${url}">${url}</a></p>
					<p>Linkki vanhenee 24 tunnissa.</p>
					<p>— Vuokramoto</p>
				`,
				text: `Vahvista sähköpostiosoitteesi:\n${url}\n\nLinkki vanhenee 24 tunnissa.`,
			});
		},
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
