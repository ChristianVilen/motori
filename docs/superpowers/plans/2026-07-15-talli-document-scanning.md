# talli Document Storage + Scanning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-vehicle private document storage in talli (rekisteriote, insurance, receipts, warranties) with a phone-camera scanning flow: snap → auto-detect edges → adjust corners → perspective-correct → multi-page PDF → upload.

**Architecture:** All image processing is client-side (OpenCV.js via `@techstark/opencv-js` + `jscanify` for detection/warp, `pdf-lib` for PDF assembly), lazy-loaded only on the scanner route. The server gains one new concern: store a private file in a new private Hetzner bucket (`STORAGE_DOCS_BUCKET`) and stream it back through an authenticated proxy route. Spec: `docs/superpowers/specs/2026-07-15-talli-document-scanning-design.md` (issues #130, #147).

**Tech Stack:** TanStack Start, Kysely/Postgres (talli schema), BetterAuth, `@aws-sdk/client-s3`, `@techstark/opencv-js`, `jscanify`, `pdf-lib`, Tailwind v4, Biome (tabs, 100-col, `noExplicitAny`, `noNonNullAssertion`).

**Testing policy:** Per the repo owner's standing preference, do NOT add automated tests. Each task verifies with `pnpm lint:fix`, `pnpm typecheck`, and (where relevant) `pnpm build` + manual checks. Existing CI must stay green. The final task runs the full verification + manual device checklist.

**Conventions that apply to every task:**
- All UI copy is Finnish. Money/none here. snake_case DB columns.
- Commit messages: conventional prefix, no `Co-Authored-By` lines, ask the user before each commit if the session rules require it.
- Run commands from the repo root. Always `pnpm`.

---

### Task 1: Dependencies

**Files:**
- Modify: `apps/talli/package.json` (via pnpm)

- [ ] **Step 1.1: Add client-side scanner deps to talli**

Dependency installation requires user confirmation per session rules — confirm before running:

```bash
pnpm --filter talli add --save-exact jscanify pdf-lib @techstark/opencv-js
```

Expected: pnpm resolves and pins exact versions (repo pins exact versions everywhere).

- [ ] **Step 1.2: Verify install**

```bash
pnpm --filter talli exec node -e "console.log(require('pdf-lib/package.json').version)"
ls node_modules/jscanify/src/
```

Expected: a version number; `jscanify.js` (and possibly `jscanify.min.js`) listed.

- [ ] **Step 1.3: Commit**

```bash
git add apps/talli/package.json pnpm-lock.yaml
git commit -m "chore(talli): add jscanify, opencv-js, pdf-lib for document scanning"
```

---

### Task 2: Migration + schema + constants

**Files:**
- Create: `apps/talli/src/lib/db/migrations/003_document.ts`
- Modify: `apps/talli/src/lib/db/schema.ts`
- Modify: `apps/talli/src/lib/constants.ts`

- [ ] **Step 2.1: Write migration `003_document.ts`**

```ts
import { type Kysely, sql } from "kysely";

// Documents store an S3 key, not a URL — the bucket is private and objects are
// only reachable via the authenticated /api/documents/$id proxy. Rows are
// immutable after creation (no rename in MVP), hence no updated_at.
export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE talli.document (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			vehicle_id uuid NOT NULL REFERENCES talli.vehicle(id) ON DELETE CASCADE,
			name text NOT NULL,
			doc_type text NOT NULL,
			storage_key text NOT NULL,
			mime_type text NOT NULL,
			size_bytes integer NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			CONSTRAINT document_type_check CHECK (
				doc_type IN ('rekisteriote', 'vakuutus', 'kuitti', 'takuu', 'muu')
			)
		)
	`.execute(db);
	await sql`CREATE INDEX document_vehicle_id_idx ON talli.document(vehicle_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE talli.document`.execute(db);
}
```

- [ ] **Step 2.2: Add `DocumentTable` to `apps/talli/src/lib/db/schema.ts`**

Insert after the `UserSettingsTable` block (before `─── Database interface`):

```ts
export type DocType = "rekisteriote" | "vakuutus" | "kuitti" | "takuu" | "muu";

export interface DocumentTable {
	id: Generated<string>;
	vehicle_id: string;
	name: string;
	doc_type: DocType;
	storage_key: string; // S3 object key — never a URL; served via /api/documents/$id
	mime_type: string;
	size_bytes: number;
	created_at: ColumnType<Date, Date | undefined, never>;
}

export type DocumentRow = Selectable<DocumentTable>;
export type NewDocument = Insertable<DocumentTable>;
```

And add to the `Database` interface:

```ts
	"talli.document": DocumentTable;
```

- [ ] **Step 2.3: Add constants to `apps/talli/src/lib/constants.ts`**

Append after `MAX_PHOTOS_PER_RECORD`:

```ts
export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_SCAN_PAGES = 20;

export const DOC_TYPES = [
	{ key: "rekisteriote", label: "Rekisteriote" },
	{ key: "vakuutus", label: "Vakuutus" },
	{ key: "kuitti", label: "Kuitti" },
	{ key: "takuu", label: "Takuu" },
	{ key: "muu", label: "Muu" },
] as const;
```

(`DocType` lives in `schema.ts`; `DOC_TYPES[number]["key"]` must stay assignable to it.)

- [ ] **Step 2.4: Run the migration against the dev DB**

Dev stack must be up (`docker compose up -d db` if not):

```bash
pnpm --filter talli db:migrate
```

Expected: `003_document` listed as executed, no errors.

- [ ] **Step 2.5: Verify + commit**

```bash
pnpm typecheck
git add apps/talli/src/lib/db/migrations/003_document.ts apps/talli/src/lib/db/schema.ts apps/talli/src/lib/constants.ts
git commit -m "feat(talli): document table, schema types, doc-type constants"
```

---

### Task 3: `@motori/server/document-storage`

**Files:**
- Create: `packages/server/src/document-storage.ts`
- Modify: `packages/server/package.json` (exports map)

- [ ] **Step 3.1: Create `packages/server/src/document-storage.ts`**

Parallel to `image-storage.ts`, but private-only (no public URL anywhere) and with a `get` read path so both backends serve through the same authenticated proxy route:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const DOC_EXT_BY_MIME: Record<string, string> = {
	"application/pdf": "pdf",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export interface StoredDocument {
	body: ReadableStream<Uint8Array> | Uint8Array;
	contentType: string;
	contentLength?: number;
}

export interface DocumentStorage {
	upload(buffer: Buffer, key: string, contentType: string): Promise<void>;
	get(key: string): Promise<StoredDocument | null>;
	delete(key: string): Promise<void>;
}

// ── Hetzner Object Storage (S3-compatible), PRIVATE bucket ─────────────────
// Deliberately no public-URL config: documents are only reachable through the
// app's authenticated proxy route, so a misconfiguration can't publish PII.

export class HetznerDocumentStorage implements DocumentStorage {
	private client: S3Client;
	private bucket: string;

	constructor() {
		this.client = new S3Client({
			region: "hel1",
			endpoint: process.env.STORAGE_ENDPOINT,
			credentials: {
				accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
				secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
			},
			forcePathStyle: true,
		});
		this.bucket = process.env.STORAGE_DOCS_BUCKET ?? "";
	}

	async upload(buffer: Buffer, key: string, contentType: string): Promise<void> {
		await this.client.send(
			new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: contentType }),
		);
	}

	async get(key: string): Promise<StoredDocument | null> {
		try {
			const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
			if (!res.Body) {
				return null;
			}
			return {
				body: res.Body.transformToWebStream(),
				contentType: res.ContentType ?? "application/octet-stream",
				contentLength: res.ContentLength,
			};
		} catch {
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}
}

// ── Local filesystem (dev) ─────────────────────────────────────────────────
// NOT served by the public /api/uploads route — dev reads go through the same
// authenticated proxy route as prod, via get().

const DOCS_DIR = path.resolve(process.cwd(), "uploads", "docs");

export class LocalDocumentStorage implements DocumentStorage {
	private resolveSafe(key: string): string | null {
		const filePath = path.resolve(DOCS_DIR, key);
		return filePath.startsWith(DOCS_DIR + path.sep) ? filePath : null;
	}

	async upload(buffer: Buffer, key: string, _contentType: string): Promise<void> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			throw new Error(`Invalid document key: ${key}`);
		}
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, buffer);
	}

	async get(key: string): Promise<StoredDocument | null> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			return null;
		}
		try {
			const body = await fs.readFile(filePath);
			const ext = path.extname(filePath).slice(1);
			const contentType =
				Object.entries(DOC_EXT_BY_MIME).find(([, e]) => e === ext)?.[0] ??
				"application/octet-stream";
			return { body: new Uint8Array(body), contentType, contentLength: body.length };
		} catch {
			return null;
		}
	}

	async delete(key: string): Promise<void> {
		const filePath = this.resolveSafe(key);
		if (!filePath) {
			return;
		}
		await fs.unlink(filePath).catch(() => {});
	}
}

// ── Factory ────────────────────────────────────────────────────────────────

let _storage: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
	if (_storage) {
		return _storage;
	}
	_storage =
		process.env.STORAGE_ENDPOINT && process.env.STORAGE_DOCS_BUCKET
			? new HetznerDocumentStorage()
			: new LocalDocumentStorage();
	return _storage;
}
```

- [ ] **Step 3.2: Add the subpath export to `packages/server/package.json`**

In the `exports` map, after `"./image-upload"`:

```json
		"./document-storage": "./src/document-storage.ts",
```

(No barrel — subpath exports only, per the SSR/client-boundary rules.)

- [ ] **Step 3.3: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add packages/server/src/document-storage.ts packages/server/package.json
git commit -m "feat(server): private document storage (Hetzner + local) with authenticated read path"
```

---

### Task 4: CSP — allow WASM for talli

**Files:**
- Modify: `packages/server/src/security-headers.ts`
- Modify: `apps/talli/src/start.ts`

- [ ] **Step 4.1: Convert the middleware to a factory**

Replace the whole of `packages/server/src/security-headers.ts` with:

```ts
import { createMiddleware } from "@tanstack/react-start";
import { getNonce } from "./nonce";

const storagePublicUrl = process.env.STORAGE_PUBLIC_URL ?? "";
const isProd = process.env.NODE_ENV === "production";

const imgSrc = storagePublicUrl
	? `'self' blob: data: ${storagePublicUrl} https://*.basemaps.cartocdn.com`
	: "'self' blob: data: https://*.basemaps.cartocdn.com";

export interface SecurityHeadersOptions {
	/** Adds 'wasm-unsafe-eval' to script-src — needed by talli's scanner (OpenCV.js WASM). */
	allowWasm?: boolean;
}

function buildCsp(nonce: string | undefined, allowWasm: boolean): string {
	// In dev, Vite injects HMR/refresh inline scripts without nonces, so we fall
	// back to 'unsafe-inline' + 'unsafe-eval' (Zod v4 uses new Function at runtime;
	// 'unsafe-eval' also permits WASM). In prod, every inline <script> must carry
	// the request nonce.
	const scriptSrc = isProd
		? `'self' 'nonce-${nonce}'${allowWasm ? " 'wasm-unsafe-eval'" : ""}`
		: "'self' 'unsafe-inline' 'unsafe-eval'";
	return [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' data: https://fonts.gstatic.com",
		`img-src ${imgSrc}`,
		"connect-src 'self'",
		"frame-ancestors 'none'",
	].join("; ");
}

export function createSecurityHeadersMiddleware({ allowWasm = false }: SecurityHeadersOptions = {}) {
	return createMiddleware({ type: "request" }).server(async ({ next }) => {
		const result = await next();
		const nonce = getNonce();
		if (isProd && !nonce) {
			throw new Error(
				"CSP nonce missing — nonceMiddleware must run before securityHeadersMiddleware",
			);
		}
		const h = result.response.headers;
		h.set("X-Content-Type-Options", "nosniff");
		h.set("X-Frame-Options", "DENY");
		h.set("Referrer-Policy", "strict-origin-when-cross-origin");
		h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
		h.set("Content-Security-Policy", buildCsp(nonce, allowWasm));
		if (isProd) {
			h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
		}
		return result;
	});
}

export const securityHeadersMiddleware = createSecurityHeadersMiddleware();
```

(The const export keeps motori's `start.ts` untouched.)

- [ ] **Step 4.2: talli opts in — replace `apps/talli/src/start.ts` contents**

```ts
import { loggingMiddleware } from "@motori/server/log/middleware";
import { nonceMiddleware } from "@motori/server/nonce";
import { createSecurityHeadersMiddleware } from "@motori/server/security-headers";
import { createStart } from "@tanstack/react-start";

// allowWasm: the document scanner runs OpenCV.js (WebAssembly), which prod CSP
// blocks without 'wasm-unsafe-eval'.
export const startInstance = createStart(() => ({
	requestMiddleware: [
		nonceMiddleware,
		createSecurityHeadersMiddleware({ allowWasm: true }),
		loggingMiddleware,
	],
}));
```

- [ ] **Step 4.3: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add packages/server/src/security-headers.ts apps/talli/src/start.ts
git commit -m "feat(server): parameterise CSP for WASM; talli allows wasm-unsafe-eval"
```

---

### Task 5: Upload endpoint

**Files:**
- Modify: `apps/talli/src/lib/log/events.ts`
- Create: `apps/talli/src/routes/api/documents/upload.ts`

- [ ] **Step 5.1: Add document events to `apps/talli/src/lib/log/events.ts`**

Add to `EVENTS` (after the `image` block):

```ts
	document: {
		uploaded: "document.uploaded",
		deleted: "document.deleted",
	},
```

And extend the `EventName` union:

```ts
	| (typeof EVENTS.document)[keyof typeof EVENTS.document]
```

- [ ] **Step 5.2: Create `apps/talli/src/routes/api/documents/upload.ts`**

Talli-only handler composing shared primitives (moves to `@motori/server` only if a second app ever needs it). Mirrors `handleImageUpload`'s flow, plus vehicle-ownership and magic-byte checks:

```ts
// POST /api/documents/upload — multipart → validate → private bucket + talli.document row.
// Documents are PRIVATE (rekisteriote carries owner PII): stored via
// @motori/server/document-storage, served only by /api/documents/$documentId.
import { DOC_EXT_BY_MIME, getDocumentStorage } from "@motori/server/document-storage";
import { checkRateLimit, getClientIp } from "@motori/server/rate-limit";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { auth } from "~/lib/auth";
import { MAX_DOCUMENT_UPLOAD_BYTES } from "~/lib/constants";
import type { DocType } from "~/lib/db/schema";
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
				doc_type: parsed.data.doc_type as DocType,
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
```

Note: if `log.event`'s typed field validation rejects the field names, match the shape used by `EVENTS.image.uploaded` in `apps/talli/src/lib/log/index.ts` — check that file if typecheck complains.

- [ ] **Step 5.3: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/lib/log/events.ts apps/talli/src/routes/api/documents/upload.ts
git commit -m "feat(talli): document upload endpoint (private storage, ownership + magic-byte checks)"
```

---

### Task 6: Authenticated download proxy

**Files:**
- Create: `apps/talli/src/routes/api/documents/$documentId.ts`

- [ ] **Step 6.1: Create the GET proxy route**

```ts
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
		"Cache-Control": "private, max-age=0",
	});
	if (obj.contentLength != null) {
		headers.set("Content-Length", String(obj.contentLength));
	}
	return new Response(obj.body, { status: 200, headers });
}

export const Route = createFileRoute("/api/documents/$documentId")({
	server: {
		handlers: {
			GET: ({ request, params }) => handleDocumentGet(request, params.documentId),
		},
	},
});
```

- [ ] **Step 6.2: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/routes/api/documents/\$documentId.ts
git commit -m "feat(talli): authenticated document download proxy"
```

---

### Task 7: Server fns — delete, list, vehicle-delete cleanup

**Files:**
- Create: `apps/talli/src/lib/documents.ts`
- Modify: `apps/talli/src/lib/vehicles.ts` (two places: `getVehicleDetail`, `deleteVehicle`)

- [ ] **Step 7.1: Create `apps/talli/src/lib/documents.ts`**

```ts
import { getDocumentStorage } from "@motori/server/document-storage";
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
		// Row first, object best-effort after: an orphaned object is invisible;
		// a dangling row would 404 on open.
		await getDocumentStorage()
			.delete(doc.storage_key)
			.catch(() => {});
		log.event(EVENTS.document.deleted, { documentId: id });
	});
```

- [ ] **Step 7.2: Return documents from `getVehicleDetail`**

In `apps/talli/src/lib/vehicles.ts`, inside `getVehicleDetail`'s handler, after the `photos` query add:

```ts
		const documents = await db
			.selectFrom("talli.document")
			.select(["id", "name", "doc_type", "mime_type", "size_bytes", "created_at"])
			.where("vehicle_id", "=", vehicle.id)
			.orderBy("created_at", "desc")
			.execute();
```

and add `documents,` to the returned object:

```ts
		return {
			vehicle,
			reminders: reminders.map((r) => ({ ...r, state: computeDueState(r, vehicle.odometer_km) })),
			records: records.map((r) => ({
				...r,
				photos: photos.filter((p) => p.service_record_id === r.id),
			})),
			documents,
		};
```

- [ ] **Step 7.3: Clean up storage objects in `deleteVehicle`**

The FK cascade removes `talli.document` rows but would orphan private bucket objects. Replace `deleteVehicle`'s handler body in `apps/talli/src/lib/vehicles.ts`:

```ts
	.handler(async ({ data: { id } }) => {
		const userId = requireUserId(await getSession());
		const db = await getDb();
		await getOwnedVehicle(db, id, userId);
		const docs = await db
			.selectFrom("talli.document")
			.select("storage_key")
			.where("vehicle_id", "=", id)
			.execute();
		await db.deleteFrom("talli.vehicle").where("id", "=", id).execute();
		// Cascade removed the rows; now best-effort delete the private objects.
		const { getDocumentStorage } = await import("@motori/server/document-storage");
		for (const doc of docs) {
			await getDocumentStorage()
				.delete(doc.storage_key)
				.catch(() => {});
		}
		log.event(EVENTS.vehicle.deleted, { vehicleId: id });
	});
```

(Lazy import keeps the module out of any client trace of `vehicles.ts`, which route components import for `getVehicleDetail` — same reason the file lazy-imports `db`.)

- [ ] **Step 7.4: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/lib/documents.ts apps/talli/src/lib/vehicles.ts
git commit -m "feat(talli): document list/delete server fns, storage cleanup on vehicle delete"
```

---

### Task 8: Scanner library (CV loading, geometry, PDF)

**Files:**
- Create: `apps/talli/src/types/jscanify.d.ts`
- Create: `apps/talli/src/lib/scanner/geometry.ts`
- Create: `apps/talli/src/lib/scanner/load-scanner.ts`
- Create: `apps/talli/src/lib/scanner/pdf.ts`
- Modify: `apps/talli/vite.config.ts` (chunk-size warning limit)

- [ ] **Step 8.1: Type declarations for jscanify — `apps/talli/src/types/jscanify.d.ts`**

```ts
declare module "jscanify" {
	interface Point {
		x: number;
		y: number;
	}
	interface CornerPoints {
		topLeftCorner: Point;
		topRightCorner: Point;
		bottomRightCorner: Point;
		bottomLeftCorner: Point;
	}
	/** Reads the global `cv` (OpenCV.js) at call time — set globalThis.cv before use. */
	export default class Jscanify {
		findPaperContour(image: unknown): unknown;
		getCornerPoints(contour: unknown): CornerPoints;
		extractPaper(
			image: HTMLImageElement | HTMLCanvasElement,
			resultWidth: number,
			resultHeight: number,
			cornerPoints?: CornerPoints,
		): HTMLCanvasElement;
	}
}
```

(Confirm `tsconfig.json` includes `src` so the `.d.ts` is picked up — it will be under `src/types/`.)

- [ ] **Step 8.2: `apps/talli/src/lib/scanner/geometry.ts`**

```ts
export interface Point {
	x: number;
	y: number;
}

export interface Corners {
	topLeftCorner: Point;
	topRightCorner: Point;
	bottomRightCorner: Point;
	bottomLeftCorner: Point;
}

export type CornerKey = keyof Corners;

export function fullImageCorners(width: number, height: number): Corners {
	return {
		topLeftCorner: { x: 0, y: 0 },
		topRightCorner: { x: width, y: 0 },
		bottomRightCorner: { x: width, y: height },
		bottomLeftCorner: { x: 0, y: height },
	};
}

function dist(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Output page size for a warped quad: the longer of each opposing edge pair. */
export function outputSize(c: Corners): { width: number; height: number } {
	return {
		width: Math.max(1, Math.round(Math.max(dist(c.topLeftCorner, c.topRightCorner), dist(c.bottomLeftCorner, c.bottomRightCorner)))),
		height: Math.max(1, Math.round(Math.max(dist(c.topLeftCorner, c.bottomLeftCorner), dist(c.topRightCorner, c.bottomRightCorner)))),
	};
}

/** Downscale a canvas so its long edge is at most maxEdge (returns input if already small). */
export function downscale(canvas: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
	const scale = maxEdge / Math.max(canvas.width, canvas.height);
	if (scale >= 1) {
		return canvas;
	}
	const out = document.createElement("canvas");
	out.width = Math.round(canvas.width * scale);
	out.height = Math.round(canvas.height * scale);
	const ctx = out.getContext("2d");
	if (!ctx) {
		return canvas;
	}
	ctx.drawImage(canvas, 0, 0, out.width, out.height);
	return out;
}
```

- [ ] **Step 8.3: `apps/talli/src/lib/scanner/load-scanner.ts`**

```ts
import type Jscanify from "jscanify";
import { type Corners, downscale, fullImageCorners, outputSize } from "~/lib/scanner/geometry";

// OpenCV.js is ~10 MB of WASM — everything here is dynamic-import'ed so it only
// loads on the scanner route, never in the main bundle or on the server.

interface OpenCv {
	Mat?: unknown;
	imread(source: HTMLImageElement | HTMLCanvasElement): { delete(): void };
	onRuntimeInitialized?: () => void;
}

interface Loaded {
	scanner: Jscanify;
	cv: OpenCv;
}

let loading: Promise<Loaded> | null = null;

export function loadScanner(): Promise<Loaded> {
	if (!loading) {
		loading = (async () => {
			const cvModule = await import("@techstark/opencv-js");
			const cv = cvModule.default as unknown as OpenCv;
			await new Promise<void>((resolve) => {
				if (cv.Mat) {
					resolve();
					return;
				}
				cv.onRuntimeInitialized = () => resolve();
			});
			// jscanify reads the global `cv` at call time.
			(globalThis as { cv?: OpenCv }).cv = cv;
			const { default: JscanifyCtor } = await import("jscanify");
			return { scanner: new JscanifyCtor(), cv };
		})();
		loading.catch(() => {
			loading = null; // allow retry after a failed load
		});
	}
	return loading;
}

/** Detect document corners; falls back to the full image when detection fails. */
export async function detectCorners(img: HTMLImageElement): Promise<Corners> {
	const fallback = fullImageCorners(img.naturalWidth, img.naturalHeight);
	try {
		const { scanner, cv } = await loadScanner();
		const mat = cv.imread(img);
		try {
			const contour = scanner.findPaperContour(mat);
			if (!contour) {
				return fallback;
			}
			return scanner.getCornerPoints(contour);
		} finally {
			mat.delete();
		}
	} catch {
		return fallback;
	}
}

/** Perspective-correct the quad out of the photo, downscaled to max 2000 px long edge. */
export async function extractPage(img: HTMLImageElement, corners: Corners): Promise<HTMLCanvasElement> {
	const { scanner } = await loadScanner();
	const { width, height } = outputSize(corners);
	const canvas = scanner.extractPaper(img, width, height, corners);
	return downscale(canvas, 2000);
}
```

- [ ] **Step 8.4: `apps/talli/src/lib/scanner/pdf.ts`**

```ts
// pdf-lib is dynamic-import'ed so it stays out of the main bundle.
export async function pagesToPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
	const { PDFDocument } = await import("pdf-lib");
	const pdf = await PDFDocument.create();
	for (const canvas of pages) {
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Sivun pakkaus epäonnistui"))),
				"image/jpeg",
				0.8,
			);
		});
		const jpg = await pdf.embedJpg(await blob.arrayBuffer());
		const page = pdf.addPage([jpg.width, jpg.height]);
		page.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height });
	}
	const bytes = await pdf.save();
	return new Blob([bytes as BlobPart], { type: "application/pdf" });
}
```

- [ ] **Step 8.5: Raise the chunk-size warning limit in `apps/talli/vite.config.ts`**

In the `build` block, alongside `rollupOptions`:

```ts
	build: {
		// OpenCV.js is a single ~10 MB lazy chunk (scanner route only) — silence
		// the default 500 kB warning rather than pretend we can split WASM.
		chunkSizeWarningLimit: 12_000,
		rollupOptions: {
			external: ["pg", "pg-pool", "pg-connection-string", "pgpass", "split2"],
		},
	},
```

- [ ] **Step 8.6: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/types/jscanify.d.ts apps/talli/src/lib/scanner apps/talli/vite.config.ts
git commit -m "feat(talli): scanner library — lazy OpenCV/jscanify loading, geometry, PDF assembly"
```

---

### Task 9: Corner-adjust component

**Files:**
- Create: `apps/talli/src/components/scanner/corner-adjust.tsx`

- [ ] **Step 9.1: Create the component**

SVG-based: image + quad polygon + four draggable handles. Coordinates live in image space (the SVG viewBox), so no manual scale math beyond the pointer→viewBox conversion.

```tsx
import { useRef, useState } from "react";
import type { CornerKey, Corners, Point } from "~/lib/scanner/geometry";

const CORNER_KEYS: CornerKey[] = [
	"topLeftCorner",
	"topRightCorner",
	"bottomRightCorner",
	"bottomLeftCorner",
];

interface CornerAdjustProps {
	src: string;
	width: number;
	height: number;
	corners: Corners;
	onChange: (corners: Corners) => void;
}

export function CornerAdjust({ src, width, height, corners, onChange }: CornerAdjustProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [dragging, setDragging] = useState<CornerKey | null>(null);
	// Handle radius in viewBox units ≈ constant on-screen size across photo resolutions.
	const r = Math.max(width, height) / 28;

	function toImagePoint(e: React.PointerEvent): Point {
		const svg = svgRef.current;
		if (!svg) {
			return { x: 0, y: 0 };
		}
		const rect = svg.getBoundingClientRect();
		return {
			x: Math.min(width, Math.max(0, ((e.clientX - rect.left) / rect.width) * width)),
			y: Math.min(height, Math.max(0, ((e.clientY - rect.top) / rect.height) * height)),
		};
	}

	const points = CORNER_KEYS.map((k) => `${corners[k].x},${corners[k].y}`).join(" ");

	return (
		<svg
			ref={svgRef}
			viewBox={`0 0 ${width} ${height}`}
			className="w-full touch-none select-none rounded border border-border"
			data-testid="corner-adjust"
			onPointerMove={(e) => {
				if (dragging) {
					onChange({ ...corners, [dragging]: toImagePoint(e) });
				}
			}}
			onPointerUp={() => setDragging(null)}
			onPointerCancel={() => setDragging(null)}
			role="img"
		>
			<title>Rajaa dokumentti vetämällä kulmista</title>
			<image href={src} width={width} height={height} />
			<polygon
				points={points}
				fill="rgb(37 99 235 / 0.15)"
				stroke="rgb(37 99 235)"
				strokeWidth={r / 4}
			/>
			{CORNER_KEYS.map((k) => (
				<circle
					key={k}
					cx={corners[k].x}
					cy={corners[k].y}
					r={r}
					fill="rgb(37 99 235 / 0.5)"
					stroke="white"
					strokeWidth={r / 5}
					onPointerDown={(e) => {
						svgRef.current?.setPointerCapture(e.pointerId);
						setDragging(k);
					}}
				/>
			))}
		</svg>
	);
}
```

- [ ] **Step 9.2: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/components/scanner/corner-adjust.tsx
git commit -m "feat(talli): corner-adjust component for the document scanner"
```

---

### Task 10: Client upload helper + scanner route

**Files:**
- Create: `apps/talli/src/components/document-upload.ts`
- Create: `apps/talli/src/routes/pyorat/$vehicleId_.skannaa.tsx`

- [ ] **Step 10.1: `apps/talli/src/components/document-upload.ts`**

```ts
import type { DocType } from "~/lib/db/schema";

export interface DocumentUploadInput {
	file: Blob;
	filename: string;
	vehicleId: string;
	name: string;
	docType: DocType;
}

export async function uploadDocument(input: DocumentUploadInput): Promise<{ id: string }> {
	const form = new FormData();
	form.append("file", input.file, input.filename);
	form.append("vehicle_id", input.vehicleId);
	form.append("name", input.name);
	form.append("doc_type", input.docType);
	const res = await fetch("/api/documents/upload", { method: "POST", body: form });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? "Dokumentin lataus epäonnistui");
	}
	return (await res.json()) as { id: string };
}
```

- [ ] **Step 10.2: Create the wizard route `apps/talli/src/routes/pyorat/$vehicleId_.skannaa.tsx`**

```tsx
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@motori/ui/select";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadDocument } from "~/components/document-upload";
import { CornerAdjust } from "~/components/scanner/corner-adjust";
import { DOC_TYPES, MAX_SCAN_PAGES } from "~/lib/constants";
import type { DocType } from "~/lib/db/schema";
import { formErrorMessage } from "~/lib/errors";
import { type Corners, downscale, fullImageCorners } from "~/lib/scanner/geometry";
import { detectCorners, extractPage, loadScanner } from "~/lib/scanner/load-scanner";
import { getVehicleDetail } from "~/lib/vehicles";

export const Route = createFileRoute("/pyorat/$vehicleId_/skannaa")({
	loader: async ({ params, context }) => {
		if (!context.session) {
			throw redirect({ to: "/" });
		}
		return getVehicleDetail({ data: { vehicleId: params.vehicleId } });
	},
	component: ScanDocumentPage,
});

interface AdjustState {
	src: string;
	img: HTMLImageElement;
	corners: Corners;
}

interface ScannedPage {
	canvas: HTMLCanvasElement;
	thumb: string;
}

function ScanDocumentPage() {
	const { vehicle } = Route.useLoaderData();
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [ready, setReady] = useState(false);
	const [pages, setPages] = useState<ScannedPage[]>([]);
	const [adjust, setAdjust] = useState<AdjustState | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [docType, setDocType] = useState<DocType>("muu");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		loadScanner()
			.then(() => setReady(true))
			.catch(() => toast.error("Skannerin lataus epäonnistui. Yritä uudelleen."));
	}, []);

	async function handleFile(file: File | undefined) {
		if (!file) {
			return;
		}
		if (pages.length >= MAX_SCAN_PAGES) {
			toast.error(`Enintään ${MAX_SCAN_PAGES} sivua.`);
			return;
		}
		setBusy(true);
		try {
			const src = URL.createObjectURL(file);
			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error("Kuvan avaus epäonnistui"));
				img.src = src;
			});
			const corners = await detectCorners(img);
			setAdjust({ src, img, corners });
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function acceptPage(corners: Corners) {
		if (!adjust) {
			return;
		}
		setBusy(true);
		try {
			const canvas = await extractPage(adjust.img, corners);
			const thumb = downscale(canvas, 240).toDataURL("image/jpeg", 0.7);
			setPages((prev) => [...prev, { canvas, thumb }]);
			URL.revokeObjectURL(adjust.src);
			setAdjust(null);
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	function cancelAdjust() {
		if (adjust) {
			URL.revokeObjectURL(adjust.src);
			setAdjust(null);
		}
	}

	async function handleSave(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			const { pagesToPdf } = await import("~/lib/scanner/pdf");
			const pdf = await pagesToPdf(pages.map((p) => p.canvas));
			await uploadDocument({
				file: pdf,
				filename: "skannaus.pdf",
				vehicleId: vehicle.id,
				name,
				docType,
			});
			toast.success("Dokumentti tallennettu.");
			navigate({ to: "/pyorat/$vehicleId", params: { vehicleId: vehicle.id } });
		} catch (err) {
			// Pages stay in state — retry doesn't mean re-scanning.
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	if (adjust) {
		return (
			<div className="mx-auto max-w-lg" data-testid="scan-adjust">
				<h1 className="font-heading text-2xl font-bold">Rajaa sivu</h1>
				<p className="mt-1 text-sm text-muted">Vedä kulmat dokumentin reunoille.</p>
				<div className="mt-4">
					<CornerAdjust
						src={adjust.src}
						width={adjust.img.naturalWidth}
						height={adjust.img.naturalHeight}
						corners={adjust.corners}
						onChange={(corners) => setAdjust({ ...adjust, corners })}
					/>
				</div>
				<div className="mt-4 grid gap-2">
					<Button
						data-testid="accept-page"
						disabled={busy}
						onClick={() => acceptPage(adjust.corners)}
					>
						Hyväksy sivu
					</Button>
					<Button
						variant="outline"
						disabled={busy}
						onClick={() =>
							acceptPage(fullImageCorners(adjust.img.naturalWidth, adjust.img.naturalHeight))
						}
					>
						Käytä koko kuvaa
					</Button>
					<Button variant="outline" disabled={busy} onClick={cancelAdjust}>
						Peruuta
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-lg" data-testid="scan-page">
			<Link
				to="/pyorat/$vehicleId"
				params={{ vehicleId: vehicle.id }}
				className="text-sm text-muted hover:text-foreground"
			>
				← Takaisin
			</Link>
			<h1 className="mt-2 font-heading text-2xl font-bold">Skannaa dokumentti</h1>

			{!ready ? <p className="mt-4 text-sm text-muted">Ladataan skanneria…</p> : null}

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				capture="environment"
				className="sr-only"
				data-testid="scan-file-input"
				onChange={(e) => {
					handleFile(e.target.files?.[0]);
					e.target.value = "";
				}}
			/>

			{pages.length > 0 ? (
				<div className="mt-4 flex flex-wrap gap-2" data-testid="scan-pages">
					{pages.map((p, i) => (
						<button
							key={p.thumb}
							type="button"
							title="Poista sivu"
							onClick={() => setPages((prev) => prev.filter((_, j) => j !== i))}
						>
							<img src={p.thumb} alt={`Sivu ${i + 1}`} className="h-24 rounded border border-border object-cover" />
						</button>
					))}
				</div>
			) : null}

			{!showForm ? (
				<div className="mt-6 grid gap-2">
					<Button
						data-testid="scan-capture"
						disabled={!ready || busy}
						onClick={() => fileInputRef.current?.click()}
					>
						{pages.length === 0 ? "Ota kuva" : "Lisää sivu"}
					</Button>
					{pages.length > 0 ? (
						<Button variant="outline" data-testid="scan-done" onClick={() => setShowForm(true)}>
							Valmis ({pages.length} {pages.length === 1 ? "sivu" : "sivua"})
						</Button>
					) : null}
				</div>
			) : (
				<form onSubmit={handleSave} className="mt-6 grid gap-4" data-testid="scan-save-form">
					<label htmlFor="doc-name" className="grid gap-1 text-sm font-medium">
						Nimi *
						<Input
							id="doc-name"
							data-testid="doc-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							required
						/>
					</label>
					<label htmlFor="doc-type" className="grid gap-1 text-sm font-medium">
						Tyyppi
						<Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
							<SelectTrigger id="doc-type" data-testid="doc-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DOC_TYPES.map((t) => (
									<SelectItem key={t.key} value={t.key}>
										{t.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</label>
					<Button type="submit" data-testid="doc-save" disabled={busy || !name.trim()}>
						{busy ? "Tallennetaan…" : `Tallenna PDF (${pages.length} sivua)`}
					</Button>
					<Button type="button" variant="outline" disabled={busy} onClick={() => setShowForm(false)}>
						Takaisin
					</Button>
				</form>
			)}
		</div>
	);
}
```

Note for the implementer: `@motori/ui/select` exports the Radix pieces used above — check `packages/ui/package.json` exports for the exact subpath (`@motori/ui/select`), matching how `button`/`input` are imported elsewhere in talli.

- [ ] **Step 10.3: Regenerate the route tree, verify, commit**

```bash
DEPLOY_APP=talli pnpm build   # regenerates apps/talli routeTree.gen.ts
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/components/document-upload.ts "apps/talli/src/routes/pyorat/\$vehicleId_.skannaa.tsx" apps/talli/src/routeTree.gen.ts
git commit -m "feat(talli): document scanner wizard route (snap → adjust corners → multi-page PDF)"
```

(If the route tree isn't referenced from git status, TanStack regenerated it in place — include whatever path shows as modified.)

---

### Task 11: Vehicle-page Dokumentit section + plain upload

**Files:**
- Create: `apps/talli/src/components/documents-section.tsx`
- Modify: `apps/talli/src/routes/pyorat/$vehicleId.tsx`

- [ ] **Step 11.1: Create `apps/talli/src/components/documents-section.tsx`**

```tsx
import { Button } from "@motori/ui/button";
import { Input } from "@motori/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@motori/ui/select";
import { Link, useRouter } from "@tanstack/react-router";
import { FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { uploadDocument } from "~/components/document-upload";
import { DOC_TYPES } from "~/lib/constants";
import type { DocType } from "~/lib/db/schema";
import { deleteDocument } from "~/lib/documents";
import { formErrorMessage } from "~/lib/errors";

interface DocumentListItem {
	id: string;
	name: string;
	doc_type: DocType;
	mime_type: string;
	size_bytes: number;
	created_at: Date;
}

function formatSize(bytes: number): string {
	return bytes >= 1024 * 1024
		? `${(bytes / 1024 / 1024).toFixed(1)} Mt`
		: `${Math.max(1, Math.round(bytes / 1024))} kt`;
}

export function DocumentsSection({
	vehicleId,
	documents,
}: {
	vehicleId: string;
	documents: DocumentListItem[];
}) {
	const router = useRouter();
	const [showUpload, setShowUpload] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [name, setName] = useState("");
	const [docType, setDocType] = useState<DocType>("muu");
	const [busy, setBusy] = useState(false);

	async function handleUpload(e: React.FormEvent) {
		e.preventDefault();
		if (!file) {
			return;
		}
		setBusy(true);
		try {
			await uploadDocument({ file, filename: file.name, vehicleId, name, docType });
			setShowUpload(false);
			setFile(null);
			setName("");
			setDocType("muu");
			router.invalidate();
		} catch (err) {
			toast.error(formErrorMessage(err));
		} finally {
			setBusy(false);
		}
	}

	async function handleDelete(id: string) {
		if (!window.confirm("Poistetaanko dokumentti?")) {
			return;
		}
		try {
			await deleteDocument({ data: { id } });
			router.invalidate();
		} catch (err) {
			toast.error(formErrorMessage(err));
		}
	}

	return (
		<section className="mt-8" data-testid="documents-section">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="font-heading text-lg font-semibold">Dokumentit</h2>
				<div className="flex gap-2">
					<Button asChild size="sm">
						<Link
							to="/pyorat/$vehicleId/skannaa"
							params={{ vehicleId }}
							data-testid="scan-document"
						>
							Skannaa dokumentti
						</Link>
					</Button>
					<Button
						size="sm"
						variant="outline"
						data-testid="add-document-file"
						onClick={() => setShowUpload((v) => !v)}
					>
						Lisää tiedosto
					</Button>
				</div>
			</div>

			{showUpload ? (
				<form
					onSubmit={handleUpload}
					className="mt-3 grid gap-3 rounded-lg border border-border p-4"
					data-testid="document-upload-form"
				>
					<label htmlFor="doc-file" className="grid gap-1 text-sm font-medium">
						Tiedosto (PDF tai kuva) *
						{/* No capture attribute: keeps the iOS Files → ⋯ → Scan Documents route reachable. */}
						<input
							id="doc-file"
							type="file"
							accept="application/pdf,image/*"
							data-testid="doc-file-input"
							className="text-sm"
							onChange={(e) => {
								const f = e.target.files?.[0] ?? null;
								setFile(f);
								if (f && !name) {
									setName(f.name.replace(/\.[^.]+$/, "").slice(0, 100));
								}
							}}
						/>
					</label>
					<label htmlFor="doc-upload-name" className="grid gap-1 text-sm font-medium">
						Nimi *
						<Input
							id="doc-upload-name"
							data-testid="doc-upload-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={100}
							required
						/>
					</label>
					<label htmlFor="doc-upload-type" className="grid gap-1 text-sm font-medium">
						Tyyppi
						<Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
							<SelectTrigger id="doc-upload-type" data-testid="doc-upload-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{DOC_TYPES.map((t) => (
									<SelectItem key={t.key} value={t.key}>
										{t.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</label>
					<Button
						type="submit"
						size="sm"
						data-testid="doc-upload-submit"
						disabled={busy || !file || !name.trim()}
					>
						{busy ? "Ladataan…" : "Tallenna"}
					</Button>
				</form>
			) : null}

			{documents.length === 0 ? (
				<p className="mt-2 text-sm text-muted">Ei dokumentteja.</p>
			) : (
				<ul className="mt-3 grid gap-2" data-testid="document-list">
					{documents.map((d) => {
						const typeLabel = DOC_TYPES.find((t) => t.key === d.doc_type)?.label ?? d.doc_type;
						return (
							<li
								key={d.id}
								data-testid="document-row"
								className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3"
							>
								<a
									href={`/api/documents/${d.id}`}
									target="_blank"
									rel="noreferrer"
									className="flex min-w-0 items-center gap-3 hover:underline"
								>
									{d.mime_type === "application/pdf" ? (
										<FileText className="h-5 w-5 shrink-0 text-muted" />
									) : (
										<ImageIcon className="h-5 w-5 shrink-0 text-muted" />
									)}
									<span className="min-w-0">
										<span className="block truncate text-sm font-medium">{d.name}</span>
										<span className="block text-xs text-muted">
											{typeLabel} · {new Date(d.created_at).toLocaleDateString("fi-FI")} ·{" "}
											{formatSize(d.size_bytes)}
										</span>
									</span>
								</a>
								<Button
									size="sm"
									variant="outline"
									data-testid={`delete-document-${d.name}`}
									onClick={() => handleDelete(d.id)}
								>
									Poista
								</Button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
```

- [ ] **Step 11.2: Mount it on the vehicle page**

In `apps/talli/src/routes/pyorat/$vehicleId.tsx`:

1. Add the import: `import { DocumentsSection } from "~/components/documents-section";`
2. Destructure `documents` from the loader data: `const { vehicle, reminders, records, documents } = Route.useLoaderData();`
3. Insert between the Huoltokirja `</section>` and the Varaosat section:

```tsx
			<DocumentsSection vehicleId={vehicle.id} documents={documents} />
```

- [ ] **Step 11.3: Verify + commit**

```bash
pnpm lint:fix
pnpm typecheck
git add apps/talli/src/components/documents-section.tsx "apps/talli/src/routes/pyorat/\$vehicleId.tsx"
git commit -m "feat(talli): Dokumentit section with plain PDF/image upload on vehicle page"
```

---

### Task 12: Env, deploy runbook, CLAUDE.md

**Files:**
- Modify: `.env.example`
- Modify: `.env.ci`
- Modify: `DEPLOY.md`
- Modify: `CLAUDE.md`

- [ ] **Step 12.1: Env files**

Add to `.env.example`, next to the other `STORAGE_*` vars:

```
# Private bucket for talli documents (rekisteriote etc.) — no public read access.
STORAGE_DOCS_BUCKET=motori-docs
```

Add the same line (without comment) to `.env.ci`. (In CI/dev `STORAGE_ENDPOINT` is unset, so `LocalDocumentStorage` is used and the var is inert — it's listed for sync per the CI convention.)

- [ ] **Step 12.2: DEPLOY.md**

Read `DEPLOY.md`, find the object-storage section (the one covering `motori-images`/`motori-backups`), and append a subsection:

```markdown
### Private documents bucket (talli)

talli stores per-vehicle documents (rekisteriote, insurance docs — PII) in a third bucket:

- **`motori-docs`** — **private** (no public read). Created in the same Hetzner Object Storage
  project, reachable with the existing project-wide access keys. Never enable public access;
  documents are served only through talli's authenticated `/api/documents/$id` proxy.

Config on the talli Dokku app:

    dokku config:set talli STORAGE_DOCS_BUCKET=motori-docs
```

Match the surrounding section numbering/formatting when inserting.

- [ ] **Step 12.3: CLAUDE.md updates**

Keep them minimal:

1. In the `packages/server` bullet of *Monorepo layout*, add `document-storage` to the list of subpath exports.
2. In *Storage*, extend the bucket list: after the `motori-backups` sentence, add: `and **`motori-docs`** — **private**, talli's per-vehicle documents (rekisteriote etc.), served only via talli's authenticated `/api/documents/$id` proxy (`STORAGE_DOCS_BUCKET`); never enable public read.`
3. In *talli domain rules*, add: `- Documents (talli.document) attach to vehicles only; files live in the private motori-docs bucket, rows store a storage key (never a URL). The scanner (OpenCV.js WASM) is why talli's CSP includes 'wasm-unsafe-eval'.`

- [ ] **Step 12.4: Commit**

```bash
git add .env.example .env.ci DEPLOY.md CLAUDE.md
git commit -m "docs: private docs bucket env, deploy runbook, CLAUDE.md for talli documents"
```

---

### Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 13.1: Repo-wide checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: all pass (no new tests were added; existing suites must stay green).

- [ ] **Step 13.2: Build both apps + client-bundle safety check**

```bash
pnpm build
DEPLOY_APP=talli pnpm build
grep -l "AsyncLocalStorage\|node:fs" apps/talli/.output/public/assets/*.js || echo "CLEAN"
```

Expected: builds succeed; grep prints `CLEAN` (no node-only symbols leaked into client chunks — `document-storage` must never appear in a client trace).

- [ ] **Step 13.3: CSP smoke test (prod server, real nonce + WASM)**

```bash
DEPLOY_APP=talli pnpm build && node apps/talli/.output/server/index.mjs
```

Then in a browser against the served app: log in, open a vehicle → *Skannaa dokumentti*, confirm the scanner loads ("Ladataan skanneria…" resolves) and DevTools shows **no CSP violations** (WASM compiles under `'wasm-unsafe-eval'`).

- [ ] **Step 13.4: Manual dev-flow check (LocalDocumentStorage)**

With `pnpm dev` running, on http://localhost:3001:

1. Scan flow: pick an image of a paper → corners detected → drag a corner → *Hyväksy sivu* → *Lisää sivu* (second page) → *Valmis* → name + type → *Tallenna PDF* → lands on vehicle page, document listed.
2. Open the document — the PDF renders inline in a new tab; URL is `/api/documents/<uuid>`.
3. Plain upload: *Lisää tiedosto* with a PDF → listed and opens.
4. Auth: open the document URL in a private window → 401/404, never the file.
5. Delete: *Poista* removes the row; the file under `apps/talli/uploads/docs/` is gone.

- [ ] **Step 13.5: On-device checklist (record results in the PR description)**

- iPhone Safari: camera capture, corner drag by touch, multi-page scan, PDF opens inline.
- iPhone Safari: *Lisää tiedosto* → Files → ⋯ → *Scan Documents* → native multi-page PDF uploads and serves.
- Android Chrome: scan flow end-to-end.

- [ ] **Step 13.6: Wrap up**

Per repo rules, work isn't done until tests, format, lint and build pass. If anything failed above, fix before opening a PR. PR references issues #130 and #147.
