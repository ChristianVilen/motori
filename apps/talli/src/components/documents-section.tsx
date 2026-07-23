import { Button } from "@motori/ui/button";
import { ConfirmDialog } from "@motori/ui/confirm-dialog";
import { Input } from "@motori/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@motori/ui/select";
import { Link, useRouter } from "@tanstack/react-router";
import { FileText, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { uploadDocument } from "~/components/document-upload";
import { DOC_TYPES } from "~/lib/constants";
import type { DocType } from "~/lib/db/schema";
import { deleteDocument } from "~/lib/documents";
import { useSubmit } from "~/lib/use-submit";

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
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const { saving, submit } = useSubmit();

	async function handleUpload(e: React.FormEvent) {
		e.preventDefault();
		if (!file) {
			return;
		}
		await submit(async () => {
			await uploadDocument({ file, filename: file.name, vehicleId, name, docType });
			setShowUpload(false);
			setFile(null);
			setName("");
			setDocType("muu");
			router.invalidate();
		});
	}

	async function handleDelete() {
		if (!deleteId) {
			return;
		}
		await submit(async () => {
			await deleteDocument({ data: { id: deleteId } });
			setDeleteId(null);
			router.invalidate();
		});
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
						disabled={saving || !file || !name.trim()}
					>
						{saving ? "Ladataan…" : "Tallenna"}
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
									onClick={() => setDeleteId(d.id)}
								>
									Poista
								</Button>
							</li>
						);
					})}
				</ul>
			)}

			<ConfirmDialog
				open={deleteId !== null}
				title="Poistetaanko dokumentti?"
				confirmLabel="Poista"
				cancelLabel="Peruuta"
				destructive
				busy={saving}
				onConfirm={handleDelete}
				onCancel={() => setDeleteId(null)}
			/>
		</section>
	);
}
