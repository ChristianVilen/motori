// POST /api/documents/upload — multipart → validate → private bucket + talli.document row.
// Documents are PRIVATE (rekisteriote carries owner PII): stored via
// @motori/server/document-storage, served only by /api/documents/$documentId.
import { DOC_EXT_BY_MIME, getDocumentStorage } from "@motori/server/document-storage";
import { checkRateLimit, getClientIp } from "@motori/server/rate-limit";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { auth } from "~/lib/auth";
import { MAX_DOCUMENT_UPLOAD_BYTES } from "~/lib/constants";
import { log } from "~/lib/log";
import { EVENTS } from "~/lib/log/events";
import { getOwnedVehicle } from "~/lib/vehicles";

const fieldsSchema = z.object({
	vehicle_id: z.string().uuid(),
	name: z.string().trim().min(1).max(100),
	doc_type: z.enum(["rekisteriote", "vakuutus", "kuitti", "takuu", "muu"]),
});

function jsonError(error: string, status: number) {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** A spoofed Content-Type must not smuggle arbitrary files into storage. */
function magicBytesMatch(mime: string, buf: Buffer): boolean {
	switch (mime) {
		case "application/pdf":
			return buf.subarray(0, 4).toString("latin1") === "%PDF";
		case "image/jpeg":
			return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
		case "image/png":
			return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
		case "image/webp":
			return (
				buf.subarray(0, 4).toString("latin1") === "RIFF" &&
				buf.subarray(8, 12).toString("latin1") === "WEBP"
			);
		default:
			return false;
	}
}

async function handleDocumentUpload(request: Request): Promise<Response> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) {
		return jsonError("Kirjaudu sisään", 401);
	}
	if (!session.user.emailVerified) {
		return jsonError("Vahvista sähköpostiosoitteesi ensin", 403);
	}

	const expectedOrigin = new URL(
		process.env.APP_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
	).origin;
	const origin = request.headers.get("origin");
	if (!origin || origin !== expectedOrigin) {
		return jsonError("CSRF validation failed", 403);
	}

	const ip = getClientIp(request);
	if (ip) {
		const { allowed, retryAfter } = checkRateLimit(`talli-doc-upload:${ip}`, 20, 60_000);
		if (!allowed) {
			return new Response(
				JSON.stringify({ error: `Liian monta latausta. Yritä ${retryAfter}s kuluttua.` }),
				{
					status: 429,
					headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
				},
			);
		}
	}

	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return jsonError("Tiedosto puuttuu", 400);
	}
	const parsed = fieldsSchema.safeParse({
		vehicle_id: formData.get("vehicle_id"),
		name: formData.get("name"),
		doc_type: formData.get("doc_type"),
	});
	if (!parsed.success) {
		return jsonError("Tarkista syötteet", 400);
	}
	const ext = DOC_EXT_BY_MIME[file.type];
	if (!ext) {
		return jsonError("Vain PDF, JPEG, PNG ja WebP sallittu", 400);
	}
	if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
		return jsonError(
			`Tiedosto on liian suuri (max ${Math.round(MAX_DOCUMENT_UPLOAD_BYTES / 1024 / 1024)} MB)`,
			400,
		);
	}

	const raw = Buffer.from(await file.arrayBuffer());
	if (!magicBytesMatch(file.type, raw)) {
		return jsonError("Tiedoston sisältö ei vastaa tyyppiä", 400);
	}

	const { db } = await import("~/lib/db/index");
	try {
		await getOwnedVehicle(db, parsed.data.vehicle_id, session.user.id);
	} catch {
		return jsonError("Pyörää ei löytynyt", 404);
	}

	const id = crypto.randomUUID();
	const key = `talli/${session.user.id}/${id}.${ext}`;
	const storage = getDocumentStorage();
	await storage.upload(raw, key, file.type);
	try {
		await db
			.insertInto("talli.document")
			.values({
				id,
				vehicle_id: parsed.data.vehicle_id,
				name: parsed.data.name,
				doc_type: parsed.data.doc_type,
				storage_key: key,
				mime_type: file.type,
				size_bytes: file.size,
			})
			.execute();
	} catch (err) {
		await storage.delete(key).catch(() => {});
		throw err;
	}

	log.event(EVENTS.document.uploaded, {
		documentId: id,
		vehicleId: parsed.data.vehicle_id,
		docType: parsed.data.doc_type,
		sizeBytes: file.size,
		mime: file.type,
	});
	return new Response(JSON.stringify({ id }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

export const Route = createFileRoute("/api/documents/upload")({
	server: {
		handlers: {
			POST: ({ request }) => handleDocumentUpload(request),
		},
	},
});
