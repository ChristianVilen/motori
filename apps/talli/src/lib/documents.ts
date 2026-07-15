import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TalliError } from "~/lib/errors";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { protectedMutation } from "~/lib/middleware";
import { getSession, requireUserId } from "~/lib/session";

const getDb = async () => (await import("~/lib/db/index")).db;

export const deleteDocument = createServerFn({ method: "POST" })
	.middleware(protectedMutation("talli-document-delete", 20, 3600))
	.inputValidator((input: { id: string }) => ({ id: z.string().uuid().parse(input.id) }))
	.handler(async ({ data: { id } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		const doc = await db
			.selectFrom("talli.document")
			.innerJoin("talli.vehicle", "talli.vehicle.id", "talli.document.vehicle_id")
			.select(["talli.document.id", "talli.document.storage_key"])
			.where("talli.document.id", "=", id)
			.where("talli.vehicle.user_id", "=", userId)
			.executeTakeFirst();
		if (!doc) {
			throw new TalliError("Dokumenttia ei löytynyt");
		}
		await db.deleteFrom("talli.document").where("id", "=", doc.id).execute();
		const { getDocumentStorage } = await import("@motori/server/document-storage");
		// Row first, object best-effort after: an orphaned object is invisible;
		// a dangling row would 404 on open.
		await getDocumentStorage()
			.delete(doc.storage_key)
			.catch(() => {});
		log.event(EVENTS.document.deleted, { documentId: id });
	});
