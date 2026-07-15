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
