import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { admin } from "better-auth/plugins";
import type { Kysely } from "kysely";
import { passwordStrength } from "./password-strength";

type SendEmail = (args: { user: { id: string; email: string }; url: string }) => Promise<void>;

export function createAuth<DB>(opts: {
	db: Kysely<DB>;
	sendResetPassword: SendEmail;
	sendVerificationEmail: SendEmail;
}) {
	const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
	// Deliberate two-app special case: motori + talli are the only apps.
	// Parameterize trusted origins only if a third consumer ever appears.
	const talliOrigin =
		new URL(baseURL).hostname === "localhost" ? "http://localhost:3001" : "https://talli.motori.fi";
	// Session cookie is scoped to the apex so talli.motori.fi shares the login (SSO);
	// disabled on localhost where subdomains don't apply.
	const hostname = new URL(baseURL).hostname;
	const cookieDomain = hostname === "localhost" ? undefined : `.${hostname.replace(/^www\./, "")}`;
	return betterAuth({
		database: kyselyAdapter(opts.db, {
			type: "postgres",
		}),
		baseURL,
		trustedOrigins: [baseURL, talliOrigin],
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
			sendResetPassword: async ({ user, url }) => opts.sendResetPassword({ user, url }),
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
			...(cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : {}),
		},
		emailVerification: {
			sendOnSignUp: true,
			expiresIn: 86400, // 24 hours
			sendVerificationEmail: async ({ user, url }) => opts.sendVerificationEmail({ user, url }),
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
