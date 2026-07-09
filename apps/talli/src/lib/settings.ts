import { createServerFn } from "@tanstack/react-start";
import { AppError } from "~/lib/errors";
import { protectedMutation } from "~/lib/middleware";
import { getSession } from "~/lib/session";

const getDb = async () => (await import("~/lib/db/index")).db;

export const getSettings = createServerFn().handler(async () => {
	const session = await getSession();
	if (!session) {
		throw new AppError("Kirjaudu sisään");
	}
	const db = await getDb();
	const row = await db
		.selectFrom("talli.user_settings")
		.select("email_reminders")
		.where("user_id", "=", session.user.id)
		.executeTakeFirst();
	return { email_reminders: row?.email_reminders ?? true };
});

export const updateSettings = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-settings", 20, 3600))
	.inputValidator((input: { email_reminders: boolean }) => {
		if (typeof input.email_reminders !== "boolean") {
			throw new Error("Invalid input");
		}
		return { email_reminders: input.email_reminders };
	})
	.handler(async ({ data }) => {
		const session = await getSession();
		if (!session) {
			throw new AppError("Kirjaudu sisään");
		}
		const db = await getDb();
		await db
			.insertInto("talli.user_settings")
			.values({ user_id: session.user.id, email_reminders: data.email_reminders })
			.onConflict((oc) =>
				oc.column("user_id").doUpdateSet({
					email_reminders: data.email_reminders,
					updated_at: new Date(),
				}),
			)
			.execute();
	});
