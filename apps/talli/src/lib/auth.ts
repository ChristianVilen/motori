import { createAuth } from "@motori/server/auth";
import { db } from "~/lib/db/index";

// Session READING only — auth routes are mounted exclusively in the motori app.
// Same DATABASE_URL + BETTER_AUTH_SECRET + BETTER_AUTH_URL as motori, so the
// shared .motori.fi cookie validates here. The email senders can never fire.
export const auth = createAuth({
	db,
	sendResetPassword: async () => {},
	sendVerificationEmail: async () => {},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
