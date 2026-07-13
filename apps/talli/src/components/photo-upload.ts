export interface UploadedPhoto {
	url: string;
	thumbnail_url: string;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
	const form = new FormData();
	form.append("file", file);
	const res = await fetch("/api/images/upload", { method: "POST", body: form });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? "Kuvan lataus epäonnistui");
	}
	const data = (await res.json()) as { url: string; thumbnailUrl: string };
	return { url: data.url, thumbnail_url: data.thumbnailUrl };
}
