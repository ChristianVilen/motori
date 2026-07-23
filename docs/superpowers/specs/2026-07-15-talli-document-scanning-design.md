# talli document storage + scanning — design

Date: 2026-07-15
Status: approved design, awaiting implementation plan
Covers: GitHub issues #130 (document storage) and #147 (scan → PDF capture), designed together — capture has nowhere to put its output without storage.

## Goal

Per-vehicle document storage in talli (rekisteriote, insurance docs, receipts, warranties), with a phone-camera scanning flow that produces a clean multi-page PDF: snap a photo, auto-detect the paper's edges, let the user adjust corners, perspective-correct, repeat per page, assemble into one PDF. Documents are private (rekisteriote carries owner PII) and are never publicly reachable.

## Decisions made during brainstorm

- **#130 + #147 as one design.** Capture alone isn't testable; storage alone was undesigned.
- **Documents attach to vehicles only.** No service-record linking, no polymorphic attachments. Receipts get a type and a name.
- **Full scanning pipeline now** (issue #147's "v2"), with the UX shape *snap → review → adjust corners*, not a live viewfinder and not blind auto-crop.
- **Private bucket + app proxy**, not presigned URLs. Every document read is an authenticated request through the talli server.
- **All processing client-side** (approach A). sharp/libvips cannot do perspective correction, so server-side warping would mean OpenCV on the server; the corner-adjust UI forces OpenCV.js onto the client anyway, and once pages are warped there, pdf-lib (~200 KB) makes PDF assembly trivial. The server's only new concern: store a private file, serve it back with auth.

### The iOS constraint (why there's no "native scan" button)

iPhone's scan → auto-crop → multi-page PDF is VisionKit (`VNDocumentCameraViewController`), a native API with no web equivalent — Safari cannot invoke it programmatically. It *is* reachable indirectly: a plain file input's "Choose File" opens the Files picker, whose ⋯ menu has Scan Documents (real VisionKit, returns a proper PDF). Adding `capture` to an input skips that picker and jumps straight to the raw camera. So the design keeps two entry points: a camera-first scanner flow (with `capture`) and a plain file picker (without), which preserves the native-scan route and accepts pre-existing PDFs.

## Data model

Migration `003_document.ts` in `apps/talli/src/lib/db/migrations/` (talli schema only, as always):

```
document
  id           uuid PK default gen_random_uuid()
  vehicle_id   uuid not null → vehicle(id) on delete cascade
  name         text not null       user-given, e.g. "Vakuutuskirja 2026"
  doc_type     text not null       'rekisteriote' | 'vakuutus' | 'kuitti' | 'takuu' | 'muu'
  storage_key  text not null       S3 object key — NOT a URL
  mime_type    text not null       application/pdf | image/jpeg | image/png | image/webp
  size_bytes   integer not null
  created_at   timestamptz not null default now()
```

Departures from the photo tables, both deliberate:

- **Storage key, not URL.** There is no public URL; the serving URL is always `/api/documents/$id`.
- **No thumbnail.** The list row is type icon + name + date + size; PDF thumbnailing is real work for little value.
- No `updated_at`: rows are immutable after creation. No rename in MVP — delete and re-upload.

`doc_type` is runtime-validated as a union (TypeScript types are erased; crafted requests must be rejected server-side).

## Storage layer

New `packages/server/src/document-storage.ts`, parallel to `image-storage.ts` but with a read path the image interface lacks:

- `DocumentStorage` interface: `upload(key, body, contentType)`, `get(key)` → `{ body, contentType, size }`, `delete(key)`.
- `HetznerDocumentStorage`: same `STORAGE_ENDPOINT` / access keys / `hel1` region, new env var **`STORAGE_DOCS_BUCKET`** pointing at a new **private** bucket (`motori-docs`). There is deliberately no public-URL config, so a misconfiguration cannot publish anything.
- `LocalDocumentStorage` for dev: writes under `./uploads/docs/`, **never** served by the public `/api/uploads/` route. Dev and prod both read through the same authenticated proxy route via `storage.get()` — one code path, no divergence.
- Key shape: `talli/{userId}/{docId}.pdf` (matching extension for plain image uploads).

Ops: create the private `motori-docs` bucket (new `DEPLOY.md` step); add `STORAGE_DOCS_BUCKET` to `.env.example` and `.env.ci`.

## Server endpoints (talli app)

Talli-only for now, so handlers live in the talli app composing `@motori/server` primitives (csrf, rate-limit, document-storage); they move into the package only when a second app needs them.

**`POST /api/documents/upload`** — multipart API route, like `/api/images/upload`:

1. Session + verified email, CSRF origin check, rate limit (20/60s, prefix `talli-doc-upload`).
2. Fields: `file`, `vehicle_id`, `name`, `doc_type`. Verify the vehicle belongs to the session user. Validate `doc_type` union, mime (PDF + the three image types), and size ≤ `MAX_DOCUMENT_UPLOAD_BYTES` (10 MB).
3. Magic-byte check (`%PDF` prefix for PDFs, known headers for images) so a spoofed Content-Type can't smuggle arbitrary files.
4. `storage.upload()`, then INSERT the `document` row; return `{ id }`. If the insert fails, best-effort delete the object.

**`GET /api/documents/$documentId`** — the auth proxy: session → load row → join `vehicle` to verify ownership → `storage.get(key)` → stream with stored `Content-Type`, `Content-Disposition: inline`, `Cache-Control: private, max-age=0`. 404 for both "doesn't exist" and "not yours" (no existence oracle).

**`deleteDocument`** — `createServerFn` POST via the `protectedMutation` pattern, ownership check, delete row + object.

### CSP change

OpenCV.js is WebAssembly; prod `script-src 'self' 'nonce-…'` blocks WASM compilation. `packages/server/src/security-headers.ts` gains `'wasm-unsafe-eval'` in `script-src`, parameterised so only talli opts in. OpenCV.js/jscanify are self-hosted (bundled or in `public/`) — a CDN script would violate `script-src 'self'` regardless. Verify with the documented CSP smoke test (`pnpm build && node apps/talli/.output/server/index.mjs`, check DevTools).

## Client: scan flow

New route `pyorat/$vehicleId_.skannaa.tsx` — a self-contained wizard, same sibling-route pattern as `$vehicleId_.huolto.uusi.tsx`:

1. **Lazy-load the CV stack on mount.** jscanify + self-hosted OpenCV.js via dynamic import, only on this route (~8 MB WASM; spinner: "Ladataan skanneria…"). The main bundle never touches it.
2. **Capture:** `<input type="file" accept="image/*" capture="environment">` — `capture` is correct here because this flow *is* the camera path. iOS delivers JPEG (Safari transcodes HEIC).
3. **Review/adjust:** photo on a canvas, jscanify's detected quad drawn with four touch-sized draggable corner handles. "Käytä koko kuva" escape hatch when detection misses. Confirm → OpenCV perspective warp → corrected page.
4. **Multi-page:** thumbnail strip of accepted pages, "Lisää sivu" repeats 2–3, remove page from the strip. Max 20 pages.
5. **Save:** name + doc_type form (presets: Rekisteriote, Vakuutus, Kuitti, Takuu, Muu) → pdf-lib embeds pages as JPEG (quality ~0.8, long edge capped at 2000 px) → one PDF → POST to the upload endpoint → back to the vehicle page.

New client deps: `jscanify`, `pdf-lib`, plus the self-hosted OpenCV.js asset.

## Client: vehicle page + plain upload

New **Dokumentit** section on `pyorat/$vehicleId.tsx`, below Huoltokirja: rows of type icon · name · date · size; tap opens `/api/documents/$id` in a new tab (PDFs render inline); delete with confirm dialog. Two actions:

- **"Skannaa dokumentti"** → the wizard above.
- **"Lisää tiedosto"** → plain `<input type="file" accept="application/pdf,image/*">` *without* `capture` — the door to iOS Files → ⋯ → Scan Documents and to pre-existing PDFs. Small name/type form, direct upload, no processing.

All copy Finnish, as everywhere in talli.

## Errors and limits

- Failed edge detection never blocks: the user drags corners or takes the full image.
- Upload failure keeps assembled pages in memory; retry doesn't mean re-scanning.
- Limits: 10 MB/file, 20 pages/scan, existing rate-limit machinery. No per-vehicle document cap.

## Testing

No new automated tests unless requested (standing preference). What can't be unit-tested cheaply needs a manual on-device pass anyway; checklist for the implementation PR:

- iPhone Safari: camera capture, corner adjust by touch, multi-page scan, resulting PDF opens inline.
- iPhone Safari: Lisää tiedosto → Files → ⋯ → Scan Documents → native PDF uploads and serves.
- Android Chrome: same scan flow end-to-end.
- Unauthenticated / other-user request to `/api/documents/$id` → 404.
- CSP smoke test on the production build (WASM loads, no violations).

Existing CI (lint, format, typecheck, unit, e2e) must stay green.

## Out of scope

- Rename/edit of documents (delete and re-upload).
- PDF thumbnails, OCR, full-text search of documents.
- Service-record attachments and polymorphic document linking.
- Live-viewfinder scanning with auto-capture.
- Document reminders (e.g. insurance expiry from a scanned doc) — reminders already cover vakuutus/ajoneuvovero dates.
