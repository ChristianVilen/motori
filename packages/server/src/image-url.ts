// Re-exported from both apps' client-reachable validators.ts: keep this file import-free.
export function isValidImageUrl(url: string): boolean {
	const publicUrl = (process.env.STORAGE_PUBLIC_URL ?? "").replace(/\/$/, "");
	return url.startsWith("/api/uploads/") || (!!publicUrl && url.startsWith(`${publicUrl}/`));
}
