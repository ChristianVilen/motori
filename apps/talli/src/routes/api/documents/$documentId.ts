// GET /api/documents/$documentId — authenticated proxy for the PRIVATE docs bucket.
// 404 for both "doesn't exist" and "not yours" (no existence oracle).
import { DOC_EXT_BY_MIME, getDocumentStorage } from "@motori/server/document-storage";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { auth } from "~/lib/auth";

async function handleDocumentGet(request: Request, documentId: string): Promise<Response> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return new Response("Kirjaudu sisään", { status: 401 });
	}
	const parsed = z.string().uuid().safeParse(documentId);
	if (!parsed.success) {
		return new Response("Ei löytynyt", { status: 404 });
	}

	const { db } = await import("~/lib/db/index");
	const doc = await db
		.selectFrom("talli.document")
		.innerJoin("talli.vehicle", "talli.vehicle.id", "talli.document.vehicle_id")
		.select(["talli.document.storage_key", "talli.document.mime_type", "talli.document.name"])
		.where("talli.document.id", "=", parsed.data)
		.where("talli.vehicle.user_id", "=", session.user.id)
		.executeTakeFirst();
	if (!doc) {
		return new Response("Ei löytynyt", { status: 404 });
	}

	const obj = await getDocumentStorage().get(doc.storage_key);
	if (!obj) {
		return new Response("Ei löytynyt", { status: 404 });
	}

	const ext = DOC_EXT_BY_MIME[doc.mime_type] ?? "bin";
	const utf8Name = encodeURIComponent(doc.name).replaceAll("'", "%27");
	const headers = new Headers({
		"Content-Type": doc.mime_type,
		"Content-Disposition": `inline; filename="dokumentti.${ext}"; filename*=UTF-8''${utf8Name}.${ext}`,
		// no-store: PII documents must not land in shared-machine disk caches; we send
		// no validators, so revalidation would refetch fully anyway.
		"Cache-Control": "private, no-store",
	});
	if (obj.contentLength != null) {
		headers.set("Content-Length", String(obj.contentLength));
	}
	const body = obj.body instanceof ReadableStream ? obj.body : Buffer.from(obj.body);
	return new Response(body, { status: 200, headers });
}

export const Route = createFileRoute("/api/documents/$documentId")({
	server: {
		handlers: {
			GET: ({ request, params }) => handleDocumentGet(request, params.documentId),
		},
	},
});
